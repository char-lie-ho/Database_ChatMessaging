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
// TO_DO: dynamically add users to group based on checkboxes
// Check if the group name already exists, return false if it does
// perhaps consider using transaction for this
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
            VALUES (?, ?);
        `, [userId, roomId]);

        console.log(`User ${username} has been added to the group ${groupName}`);
        return roomId;

    } catch (error) {
        console.error('Error creating group and adding user:', error);
    }
}
async function addUserToGroup(postData) {
    const selectedUsers = postData.selectedUsers;
    const roomID = postData.room_id;
    const placeholders = selectedUsers.map(() => "(?, ?)").join(", ");
    const values = selectedUsers.flatMap(userId => [userId, roomID]);
    const sql = `INSERT INTO room_user (user_id, room_id) VALUES ${placeholders}`;

    try {
        const result = await database.query(sql, values);
        console.log("Users successfully added to the group");
    } catch (error) {
        console.error("Error adding users to group:", error);
    }

}
// Get all users except the current user
async function preCreateGroup(postData) {
    let getGroupsSQL = `
        SELECT username, user_id
        FROM user u
        WHERE username != (:username);
    `;
    let params = {
        username: postData.username
    }

    try {
        const [results] = await database.query(getGroupsSQL, params);
        return results;
    }
    catch (err) {
        console.log(err);
        return null;
    }
}
module.exports = { getGroups, createGroup, preCreateGroup, addUserToGroup };