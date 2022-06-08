<?php
// imports relative to file being used, so this file can only be used in api/*.php files
require('./private/sql.php');

// needs an 'adminID' GET parameter to be specified and correct, otherwise kills the script
function require_admin () {
    if (!array_key_exists('adminID', $_GET)) {
        die('0');
    }
    if ($_GET['adminID'] != $_ENV['ADMIN_PASS']) {
        die('0');
    }
}