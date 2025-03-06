require('./utils');

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 12;


const database = include('databaseConnection');
const db_utils = include('database/db_utils');
const db_users = include('database/users');
const db_chats = include('database/chats');
const success = db_utils.printMySQLVersion();
const port = process.env.PORT || 3000;

const app = express();

const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour  (hours * minutes * seconds * millis)


/* secret information section */
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */


app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));


var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.2vcle.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
    // mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.fuu9a.mongodb.net/sessions`,
    crypto: {
        secret: mongodb_session_secret
    }
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store 
    saveUninitialized: false,
    resave: true
}
));


app.get('/', (req, res) => {
    if (isValidSession(req)) {
        res.render('index', {
            loggedIn: true,
            username: req.session.username
        })

    } else {
        res.render('index', {
            loggedIn: false
        });
    }
});


app.get('/createTables', async (req, res) => {
    const create_tables = include('database/create_tables');
    var success = create_tables.createTables();
    if (success) {
        res.render("successMessage", { message: "Created tables." });
    }
    else {
        res.render("errorMessage", { error: "Failed to create tables." });
    }
});

app.get('/signup', (req, res) => {
    res.render("signup");
});

app.use(['/members', '/chat/:room_id'], async (req, res, next) => {
    if (req.session.authenticated) {
        req.session.chatrooms = await db_chats.getGroups({ user_id: req.session.user_id });
        req.session.usersList = await db_users.preCreateGroup({ user_id: req.session.user_id });
    }
    next();
});

app.use((req, res, next) => {
    if (req.session.authenticated) {
        res.locals.chatrooms = req.session.chatrooms || [];
        res.locals.usersList = req.session.usersList || [];
    }
    next();
});

app.get('/members', async (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/login'); // Redirect to login if no session
    }

    res.render("members", {
        username: req.session.username,
        groups: req.session.chatrooms || [] // Use cached chatroom data
    });
});


app.get('/login', (req, res) => {
    res.render('login'); // default no message
});


// Handles the logic for create new user
app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
        return res.render('signup', { message: 'Username and password cannot be empty' });
    }

    var hashedPassword = bcrypt.hashSync(password, saltRounds);

    var success = await db_users.createUser({ user: username, hashedPassword: hashedPassword });

    if (success) {
        var results = await db_users.getUsers();
        res.render('login', { message: "Your account is all set! Log in to get started!" })
        // res.render("submitUser", { users: results });
    }
    else {
        res.render("signup", { message: 'User name already taken.' });
    }

});


// Handles the logic for log in
app.post('/loggingin', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    var results = await db_users.getUser({ user: username, hashedPassword: password });

    if (results) {
        if (results.length == 1) { //there should only be 1 user in the db that matches
            if (bcrypt.compareSync(password, results[0].password)) {
                req.session.authenticated = true;
                req.session.user_type = results[0].type;
                req.session.user_id = results[0].user_id;
                req.session.username = username;
                req.session.cookie.maxAge = expireTime;
                res.redirect('/members');
                return;
            }
        }
    }

    console.log('user not found');
    //user and password combination not found
    res.render('login', { message: 'Invalid username or password' });
});


function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

function sessionValidation(req, res, next) {
    if (!isValidSession(req)) {
        req.session.destroy();
        res.redirect('/login');
        return;
    }
    else {
        next();
    }
}

app.get('/newGroup', async (req, res) => {
    if (!req.session.user_id) {
        return res.redirect('/login');
    }
    const usersList = res.locals.usersList;

    if (usersList) {
        res.render("newGroup", {
            username: req.session.username,
            users: usersList
        });
    } else {
        res.redirect('/login');
    }
});

app.post('/createGroup', async (req, res) => {
    const groupName = req.body.groupName;
    let selectedUsers = req.body.members;
    const user_id = req.session.user_id;

    // convert selectedUsers to array when only one user is selected
    if (!Array.isArray(selectedUsers)) {
        selectedUsers = selectedUsers ? [selectedUsers] : [];
    }
    try {
        // create room, add current user to room
        const room_id = await db_chats.createGroup({ groupName, user_id });
        // want to check if the room was created successfully before adding users
        if (!room_id) {
            const usersList = res.locals.usersList || await db_users.preCreateGroup({ user_id });
            return res.render("newGroup", {
                username: req.session.username,
                users: usersList,
                message: 'Group name already exists. Please try again.'
            });
        }
        // add selected users to room if any
        if (selectedUsers && selectedUsers.length > 0) {
            await db_chats.addUserToGroup({ room_id, selectedUsers });
        }
        res.redirect('/members');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

app.get('/chat/:room_id', async (req, res) => {
    const roomId = req.params.room_id;
    const user_id = req.session.user_id;
    try {
        const chatroomInfo = res.locals.chatrooms.find(room => room.room_id == roomId);
        if (!chatroomInfo) {
            return res.redirect('/members');
        }
        const messages = await db_chats.getGroupMessages({ roomId });
        let read_count = messages.length - chatroomInfo.num_message_behind;
        await db_chats.updateReadCount({ user_id, roomId });

        res.render('chatroom', {
            username: req.session.username,
            messages: messages,
            user_id: user_id,
            room_id: roomId,
            read_count: read_count,
            num_message_behind: chatroomInfo.num_message_behind
        });

    } catch (error) {
        console.error(error);
        return res.redirect('/members');
    }
});

app.post('/sendMessage', async (req, res) => {
    const user_id = req.session.user_id;
    const { message, roomId } = req.body;
    try {
        const chatroomInfo = res.locals.chatrooms.find(room => room.room_id == roomId);
        if (!chatroomInfo) {
            return res.redirect('/members');
        }
        await db_chats.addMessage({ message, user_id, roomId });
        await db_chats.updateReadCount({ user_id, roomId });
        res.redirect(`/chat/${roomId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the message.');
    }
});

app.get('/invite', async (req, res) => {
    const roomId = req.query.room_id;
    const user_id = req.session.user_id;
    try {
        const chatroomInfo = res.locals.chatrooms.find(room => room.room_id == roomId);
        if (!chatroomInfo) {
            return res.redirect('/members');
        }
        // check if any users are available to invite
        const usersList = await db_users.createInviteList({ roomId, user_id });
        if (usersList) {
            res.render("invite", {
                username: req.session.username,
                users: usersList,
                room_id: roomId
            });
        } else {
            res.redirect('/members');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while inviting people');
    }
});

app.post('/invite', (req, res) => {
    const roomId = req.body.room_id;
    let selectedUsers = req.body.members;
    // convert selectedUsers to array when only one user is selected
    if (!Array.isArray(selectedUsers)) {
        selectedUsers = selectedUsers ? [selectedUsers] : [];
    }

    try {
        // add selected users to room if any
        // console.log('selectedUsers:', selectedUsers);
        if (selectedUsers && selectedUsers.length > 0) {
            db_chats.addUserToGroup({ room_id: roomId, selectedUsers });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the message.');
    }
    finally {
        console.log('Inviting user:', selectedUsers, 'to room:', roomId);
        res.redirect(`/chat/${roomId}`);
    }
});


app.post("/add-reaction", (req, res) => {
    const { message_id, emoji, room_id } = req.body;
    const user_id = req.session.user_id;
    console.log("Adding reaction to message", message_id, "by user", user_id, "with", emoji, "in room", room_id);

    try {
        if (message_id && emoji && user_id) {
            db_chats.addReaction({ message_id, emoji, user_id });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while sending the message.');
    }
    finally {
        res.redirect(`/chat/${room_id}`);
    }
});


// middleware to check if user is logged in
app.use('/loggedin', sessionValidation);


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session:', err);
            return res.redirect('/'); // Fallback to redirect if session destruction fails
        }

        res.render('index', {
            loggedIn: false,
        });
    });
});


app.use(express.static(__dirname + "/public"));


app.use((req, res) => {
    res.status(404);
    res.render("404");
});


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500);
    res.send("Something went wrong. Please try again later.");
});

app.listen(port, () => {
    console.log("Node application listening on port " + port);
}); 