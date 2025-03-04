const database = include('databaseConnection');

async function getGroups(postData) {
    let getGroupsSQL = `
        WITH msgList AS (
            SELECT ru.room_id, MAX(m.sent_datetime) AS latestMsg
            FROM message m
            JOIN room_user ru ON m.room_user_id = ru.room_user_id
            GROUP BY ru.room_id
        )
        SELECT
            r.room_id,
            r.name AS room_name,
            msgList.latestMsg
        FROM room_user ru
        JOIN room r ON ru.room_id = r.room_id
        LEFT JOIN msgList ON msgList.room_id = r.room_id
        WHERE ru.user_id = (:user_id)
        `;

    let params = {
        user_id: postData.user_id
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

async function createGroup(postData) {
    const groupName = postData.groupName;
    const user_id = postData.user_id;

    const connection = await database.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(`
            INSERT INTO room (name, start_datetime)
            VALUES (?, NOW())
        `, [groupName]);

        const [roomResult] = await connection.query(`
            SELECT room_id 
            FROM room
            WHERE name = ?
        `, [groupName]);
        const roomId = roomResult[0].room_id;

        await connection.query(`
            INSERT INTO room_user (user_id, room_id)
            VALUES (?, ?);
        `, [user_id, roomId]);

        await connection.commit();
        return roomId;

    } catch (error) {
        await connection.rollback();
        console.error('Error creating group and adding user:', error);
    } finally {
        connection.release();
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

async function getGroupMessages(postData) {
    let getGroupMessagesSQL = `
        SELECT m.text as text, m.sent_datetime as sent_time, me.*, ru.user_id as user_id, u.username
        FROM room_user ru
        JOIN message m ON m.room_user_id = ru.room_user_id
        LEFT JOIN message_emoji me ON m.message_id = me.message_id
        JOIN user u ON ru.user_id = u.user_id
        WHERE ru.room_id = (:room_id)
        ORDER BY m.sent_datetime ASC;
    `;

    let params = {
        room_id: postData.roomId
    }

    try {
        const [results] = await database.query(getGroupMessagesSQL, params);
        console.log(results)
        return results;
    }
    catch (err) {
        console.log(err);
        return null;
    }
}

async function checkUserInGroup(postData) {
    let checkUserInGroupSQL = `
        SELECT user_id
        FROM room_user
        WHERE room_id = (:room_id) AND user_id = (:user_id);
    `;

    let params = {
        room_id: postData.roomId,
        user_id: postData.user_id
    }

    try {
        const [results] = await database.query(checkUserInGroupSQL, params);
        return results.length > 0;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}
// Get all users except the current user
async function preCreateGroup(postData) {
    let getGroupsSQL = `
        SELECT username, user_id
        FROM user u
        WHERE user_id != (:user_id);
    `;
    let params = {
        user_id: postData.user_id
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
module.exports = { getGroups, createGroup, preCreateGroup, addUserToGroup, getGroupMessages, checkUserInGroup };