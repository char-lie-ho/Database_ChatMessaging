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
    if (req.session.authenticated) {
        console.log("login");
        res.render('index', {
            loggedIn: true,
            username: req.session.username
        })

    } else {
        console.log("not login");
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
    res.render("signup", { message: null });
});

app.get('/members', (req, res) => {
    res.render("members", { username: req.session.username, user_type: req.session.user_type });
});


app.get('/login', (req, res) => {
    res.render('login', { message: null }); // default no message
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
                req.session.username = username;
                req.session.cookie.maxAge = expireTime;
                console.log('Session data after login:', req.session);
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

// middleware to check if user is logged in
app.use('/loggedin', sessionValidation);


app.get('/loggedin', (req, res) => {
    res.render("loggedin");
});

app.get('/loggedin/info', (req, res) => {
    res.render("loggedin-info");
});


app.get('/loggedin/member', (req, res) => {
    res.render("memberInfo", { username: req.session.username, user_type: req.session.user_type });
});

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