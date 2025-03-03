const database = include('databaseConnection');

async function getGroups(postData) {
    let getGroupsSQL = `
        SELECT r.room_id, r.name
        FROM user u
        JOIN room_user ru ON ru.user_id = u.user_id
        JOIN room r ON ru.room_id = r.room_id
        WHERE username = (:username);
    `;
    let params = {
        username: postData.username
    }

    try {
        const [results] = await database.query(getGroupsSQL, params);

        return results; // Return the results, not just true
    }
    catch (err) {
        console.log(err);
        return null;
    }
}

async function createGroup(postData) {
    const groupName = postData.groupName;
    const username = postData.username;

    try {
        await database.query(`
            INSERT INTO room (name, start_datetime)
            VALUES (?, NOW())
        `, [groupName]);

        const [roomResult] = await database.query(`
            SELECT room_id 
            FROM room
            WHERE name = ?
        `, [groupName]);
        const roomId = roomResult[0].room_id;

        const [userResult] = await database.query(`
            SELECT user_id 
            FROM user
            WHERE username = ?
        `, [username]);
        const userId = userResult[0].user_id;

        await database.query(`
            INSERT INTO room_user (user_id, room_id)
            VALUES (?, ?)
        `, [userId, roomId]);

        console.log(`User ${username} has been added to the group ${groupName}`);
        return true;

    } catch (error) {
        console.error('Error creating group and adding user:', error);
    }
}


module.exports = { getGroups, createGroup };