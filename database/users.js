const database = include('databaseConnection');

async function createUser(postData) {
	let createUserSQL = `
		INSERT INTO user
		(username, password)
		VALUES
		(:user, :passwordHash);
	`;

	let params = {
		user: postData.user,
		passwordHash: postData.hashedPassword
	}

	try {
		const results = await database.query(createUserSQL, params);

		console.log("Successfully created user");
		// console.log(results[0]);
		return true;
	}
	catch (err) {
		console.log("Error inserting user");
		console.log(err);
		return false;
	}
}

async function getUsers(postData) {
	let getUsersSQL = `
		SELECT username, password
		FROM user;
	`;

	try {
		const results = await database.query(getUsersSQL);
		console.log("Successfully retrieved users");
		return results[0];
	}
	catch (err) {
		console.log("Error getting users");
		console.log(err);
		return false;
	}
}

async function getUser(postData) {
	let getUserSQL = `
		SELECT user_id, username, password, type
		FROM user
		JOIN user_type USING (user_type_id)
		WHERE username = :user;
	`;

	let params = {
		user: postData.user
	}

	try {
		const results = await database.query(getUserSQL, params);
		// console.log("Trying to find user: ");
		// console.log(results[0]);
		return results[0];
	}
	catch (err) {
		console.log("Error trying to find user");
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

// async function checkUserInGroup(postData) {
// 	let checkUserInGroupSQL = `
//         SELECT user_id
//         FROM room_user
//         WHERE room_id = (:room_id) AND user_id = (:user_id);
//     `;

// 	let params = {
// 		room_id: postData.roomId,
// 		user_id: postData.user_id
// 	}

// 	try {
// 		const [results] = await database.query(checkUserInGroupSQL, params);
// 		return results.length > 0;
// 	}
// 	catch (err) {
// 		console.log(err);
// 		return false;
// 	}
// }

async function createInviteList(postData) {
	let checkUserInGroupSQL = 
		`WITH user_list AS (
    	SELECT u.user_id AS userID
    	FROM room_user ru
    	JOIN user u ON u.user_id = ru.user_id
    	WHERE ru.room_id = (:room_id)
	)
		SELECT DISTINCT u.user_id, u.username
		FROM user u
		WHERE u.user_id NOT IN (SELECT userID FROM user_list);`;

	let params = {
		room_id: postData.roomId,
	}

	try {
		const [results] = await database.query(checkUserInGroupSQL, params);
		return results;
	}
	catch (err) {
		console.log(err);
		return false;
	}
}

module.exports = { createUser, getUsers, getUser, preCreateGroup, createInviteList };