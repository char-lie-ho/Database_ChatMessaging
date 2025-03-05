const database = include('databaseConnection');

async function getGroups(postData) {
    let getGroupsSQL = `
        WITH max_message AS (
            SELECT COUNT(m.room_user_id) AS message_count, ru.room_id
        		FROM room_user ru
        		LEFT JOIN message m ON ru.room_user_id = m.room_user_id
        		GROUP BY ru.room_id
        ), unread_user_group AS (
        	SELECT ru.user_id, r.room_id, r.name, ru.read_count as current_count, mm.message_count
        		FROM room_user ru
        		JOIN room r ON r.room_id = ru.room_id
        		LEFT JOIN max_message mm ON mm.room_id = ru.room_id
        		WHERE ru.user_id = (:user_id)
        ), msgList AS (
        	SELECT ru.room_id, MAX(m.sent_datetime) AS latestMsg
        		FROM message m
        		JOIN room_user ru ON m.room_user_id = ru.room_user_id
        		GROUP BY ru.room_id
                )
        	SELECT uug.name as room_name, mm.room_id, msgList.latestMsg, (mm.message_count - uug.current_count) as num_message_behind
        	FROM unread_user_group uug
        	JOIN max_message as mm ON mm.room_id = uug.room_id
            LEFT JOIN msgList ON msgList.room_id = mm.room_id;
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
        return results;
    }
    catch (err) {
        console.log(err);
        return null;
    }
}

async function addMessage(postData) {
    let addMessageSQL = `
        INSERT INTO message (text, sent_datetime, room_user_id)
        VALUES (:message, NOW(), (
            SELECT room_user_id
            FROM room_user
            WHERE user_id = :userId AND room_id = :roomId
            LIMIT 1
        ));
    `;

    let params = {
        message: postData.message,
        userId: postData.user_id,
        roomId: postData.roomId
    }

    try {
        await database.query(addMessageSQL, params);
        return true;
    } catch (error) {
        console.error('Error adding message:', error);
    }
}

async function updateReadCount(postData) {
    let addMessageSQL = `
    UPDATE room_user ru
        JOIN (
    	SELECT COUNT(m.text) as msg_count, ru.room_id
    	    FROM message m
    	    JOIN room_user ru ON m.room_user_id = ru.room_user_id
    	    WHERE ru.room_id = :roomId ) AS message_counts
            ON ru.room_id = message_counts.room_id
            SET ru.read_count = message_counts.msg_count
            WHERE ru.room_id = :roomId AND ru.user_id = :userId;
        `;

    let params = {
        userId: postData.user_id,
        roomId: postData.roomId
    }

    try {
        await database.query(addMessageSQL, params);
        return true;
    } catch (error) {
        console.error('Error adding message:', error);
    }
}
module.exports = { getGroups, createGroup, addUserToGroup, getGroupMessages, addMessage, updateReadCount };