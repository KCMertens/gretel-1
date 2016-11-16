<?php

$currentPage = 'xps';
$step = 2;

require '../config/config.php';
require "$root/helpers.php";
require "$root/preparatory-scripts/prep-functions.php";

session_cache_limiter('private');
session_start();
header('Content-Type:text/html; charset=utf-8');

$continueConstraints = isset($_POST['xpath']) || isset($_SESSION['xpath']);
$id = session_id();

if ($continueConstraints) {
    $xpath = (isset($_POST['xpath'])) ? $_POST['xpath'] : $_SESSION['xpath'];
    $_SESSION['xpath'] = $xpath;
}

require "$root/functions.php";
require "$root/front-end-includes/head.php";

// Check if $xpath contains email addresses or website URLs
$isSpam = ($continueConstraints) ? isSpam($xpath) : false;
?>
<link rel="prefetch" href="js/min/results.min.js">
</head>
<?php flush(); ?>
<?php
require "$root/front-end-includes/header.php";

if ($continueConstraints && !$isSpam) {
    require "$root/front-end-includes/tb-sel-shared-content.php";

    setContinueNavigation(); ?>
  </form>

<?php } // $continueConstraints
else {
    if ($isSpam):
        setErrorHeading("Spam detected"); ?>
        <p>Your input example contained a hyperlink or email address and is seen as spam. Therefore we will not allow you to continue. </p>
    <?php else:
        setErrorHeading(); ?>
        <p>No search instruction could be generated, since you did not enter a valid XPath query.
            It is also possible that you came to this page directly without first entering a query.</p>
    <?php
    endif;
    setPreviousPageMessage($step-1);
}
?>

<?php
require "$root/front-end-includes/footer.php";
include "$root/front-end-includes/analytics-tracking.php";
?>
</body>
</html>
