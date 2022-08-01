<?php

/* For debugging:
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
ini_set('display_errors', true);
error_reporting(E_ALL);
//*/

// would use GET_['p'] but that auto-decodes the parameters in a weird way
// so just use the raw string
// this method is not very good though, meaning this can be the only GET parameter int eh request,
// which does work at the moment
$url = '0.0.0.0:4464/' . explode("p=", $_SERVER['REQUEST_URI'])[1];

$ch = curl_init();

/* If there was a POST request, then forward that as well.*/
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    curl_setopt($ch, CURLOPT_POST, TRUE);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $_POST);
}
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HEADER, TRUE);

$headers = getallheaders();

/* Translate some headers to make the remote party think we're actually browsing that site */
$extraHeaders = array();

/* Forward cookie as it came */
curl_setopt($ch, CURLOPT_HTTPHEADER, $extraHeaders);
if (isset($headers['Cookie'])) {
    curl_setopt($ch, CURLOPT_COOKIE, $headers['Cookie']);
}
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);


$response = curl_exec($ch);

$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($response, 0, $header_size);
$body = substr($response, $header_size);

$headerArray = explode(PHP_EOL, $headers);

/* Process response headers. */
foreach($headerArray as $header)
{
    $colonPos = strpos($header, ':');
    if ($colonPos !== FALSE)
    {
        $headerName = substr($header, 0, $colonPos);

        /* Ignore content headers, let the webserver decide how to deal with the content. */
        if (trim($headerName) == 'Content-Encoding') continue;
        if (trim($headerName) == 'Content-Length') continue;
        if (trim($headerName) == 'Transfer-Encoding') continue;
        if (trim($headerName) == 'Location') continue;
    }
    header($header, FALSE);
}
echo $body;
curl_close($ch);