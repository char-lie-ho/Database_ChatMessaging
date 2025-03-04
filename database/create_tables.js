const database = include('databaseConnection');

async function createTables() {
	let createUserTypeSQL = `
    	CREATE TABLE IF NOT EXISTS user_type (
    	    user_type_id INT NOT NULL,
    	    type VARCHAR(25) NOT NULL,
    	    PRIMARY KEY (user_type_id)
    	);
	`;

	let insertDefaultUserTypeSQL = `
		INSERT INTO user_type (user_type_id, type)
    		VALUES (1, 'default'),
    		       (2, 'admin')
    		ON DUPLICATE KEY UPDATE
    		    type = VALUES(type);`;
	
	let createUserSQL = `
		CREATE TABLE IF NOT EXISTS user (
            user_id INT NOT NULL AUTO_INCREMENT,
            username VARCHAR(25) NOT NULL,
            password VARCHAR(100) NOT NULL,
			user_type_id INT NOT NULL DEFAULT '1',
            PRIMARY KEY (user_id),
            UNIQUE INDEX unique_username (username ASC));
	`;

	let createRoomSQL = `
		CREATE TABLE IF NOT EXISTS room (
  			room_id int NOT NULL AUTO_INCREMENT,
  			name varchar(200) NOT NULL,
  			start_datetime datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  			PRIMARY KEY (room_id),
  			UNIQUE KEY Unique_name (name));
		`;

	let createRoomUserSQL = `
		CREATE TABLE IF NOT EXISTS room_user (
  			room_user_id int NOT NULL AUTO_INCREMENT,
  			user_id int NOT NULL,
  			room_id int NOT NULL,
			read_count INT DEFAULT 0,
  			PRIMARY KEY (room_user_id),
  			UNIQUE KEY unique_room_user (user_id,room_id) ,
  			CONSTRAINT room_user_room FOREIGN KEY (room_id) REFERENCES room (room_id),
  			CONSTRAINT room_user_user FOREIGN KEY (user_id) REFERENCES user (user_id));
		`;

	let createMessageSQL = `
		CREATE TABLE IF NOT EXISTS message (
  			message_id int NOT NULL AUTO_INCREMENT,
  			room_user_id int NOT NULL,
  			sent_datetime datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  			text text NOT NULL,
  			PRIMARY KEY (message_id),
  			CONSTRAINT message_room_user FOREIGN KEY (room_user_id) REFERENCES room_user (room_user_id));
  		`;
	
	let createEmojiSQL = `
		CREATE TABLE IF NOT EXISTS emoji (
			emoji_id INT,
    		name varchar(45) NOT NULL,
    		image varchar(45) NOT NULL,
    		PRIMARY KEY (emoji_id));
		`;
	
	
	let createMessageEmojiSQL = `
		CREATE TABLE message_emoji (
			message_emoji_id INT PRIMARY KEY,
			message_id INT,
			emoji_id INT,
			user_id INT,
			CONSTRAINT emoji_emoji_id FOREIGN KEY (emoji_id) REFERENCES emoji (emoji_id),
    		CONSTRAINT user_emoji_id FOREIGN KEY (user_id) REFERENCES user (user_id),
    		CONSTRAINT message_emoji_id FOREIGN KEY (message_id) REFERENCES message (message_id)); 
		`;
	
	try {
		const results = await database.query(createUserTypeSQL);
		await database.query(insertDefaultUserTypeSQL);
		await database.query(createUserSQL);
		await database.query(createRoomSQL);
		await database.query(createRoomUserSQL);
		await database.query(createMessageSQL);
		await database.query(createEmojiSQL);
		await database.query(createMessageEmojiSQL);
		console.log("Successfully created tables");
		return true;
	}
	catch (err) {
		console.log("Error Creating tables");
		console.log(err);
		return false;
	}
}

module.exports = { createTables };