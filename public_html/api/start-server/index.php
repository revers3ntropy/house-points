<?php
require_once '../secrets.php';

// Can't check user auth as the server is down :/
// could connect to the DB in PHP and check if the user is logged in

//* For debugging:
ini_set('display_errors', true);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
error_reporting(-1);
ini_set('error_reporting', E_ALL);
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
//*/

try {
	$containerName = 'house-points-api-container';
	$serverPath = '~/hpsnea-server';

	// validate user

	$session = $_GET['session'] ??  $_POST['session'] ??  $_COOKIE['session'] ?? 'a';

	if (!strlen($session)) {
		die('Error: no session');
	}

	$conn = new mysqli('localhost', USERNAME, PASSWORD, DB_NAME);

	// Check connection
	if ($conn->connect_error) {
		die(0);
	}
	echo "Connected successfully";

	$stmt = $conn->prepare("
		SELECT 1
		FROM sessions, users
		WHERE sessions.id = ?
			AND sessions.userId = users.id
			AND UNIX_TIMESTAMP(sessions.opened) + sessions.expires > UNIX_TIMESTAMP()
			AND sessions.active = 1
			AND users.admin = 1
	");
	$stmt->bind_param("s", $session);
	$stmt->execute();
	$stmt->bind_result($queryRes);
	$stmt->fetch();
	$stmt->close();

	if (!$queryRes) die(0);
	if (is_null($queryRes)) die(0);
	if (count($queryRes) === 0) die(0);

	if (strlen(`docker ps | grep $containerName`) < 2) {
		exec("cd $serverPath; npm run start");
		echo 1;
	} else {
		exec("cd $serverPath; npm run restart");
		echo 1;
	}

} catch (Exception $e) {
    echo 'Caught exception: ',  $e->getMessage(), "\n";
}
