<?php
require '../config/config.php';
require "$root/helpers.php";

session_cache_limiter('private'); // avoids page reload when going back
session_start();
header('Content-Type:text/html; charset=utf-8');

$currentPage = 'ebs';
$step = 2;

$continueConstraints = postVariablesSet(array('input', 'search'));

if ($continueConstraints) {
    $id = session_id();
    $time = time();
    $_SESSION['sentid'] = "$id-$time";

    $input = $_POST['input'];
    $_SESSION['example'] = $input;

    $_SESSION['search'] = $_POST['search'];
    $sm = $_SESSION['search'];
}

require "$root/functions.php";
require "$root/php/head.php";

if ($continueConstraints) : ?><link rel="stylesheet" href="<?php echo $home; ?>/style/css/tree-visualizer.css"><?php endif; ?>
</head>

<?php
require "$root/php/header.php";

// $error_flag = checkInputAndLog(1);

if ($continueConstraints) {
    require "$scripts/Tokenizer.php";
    require "$scripts/SimpleDOM.php";
    require "$scripts/AlpinoParser.php";
    require "$scripts/ModifyLemma.php";

    $tokinput = Tokenize($input);
    $_SESSION['sentence'] = $tokinput;
    $parse = Alpino($tokinput, $id);
    $parseloc = ModifyLemma($parse, $id, $tmp);
?>

  <p>You find the structure of the <strong>tagged</strong>
    and <strong>parsed</strong> sentence below.
    Tagging indicates <em>word classes</em>, like <strong>n</strong> (noun)
    and parsing shows <em>dependencies</em> (or relations),
     like <strong>su</strong> (subject) and <em>constituents</em>,
     like <strong>np</strong> (noun phrase).
  </p>

  <p>Your input sentence was: <em><?php echo $tokinput; ?></em></p>

  <div id="tree-output">
      <div class="loading-wrapper active">
          <div class="loading"><p>Growing a tree...<br>Please wait</p></div>
      </div>
  </div>

  <form action="matrix.php" method="post" enctype="multipart/form-data">
    <p>If the analysis is different from what you expected, you can enter
      <a href="<?php echo $home; ?>/ebs/input.php" title="Example-based search">another input example</a>.
    </p>
    <?php setContinueNavigation(); ?>
  </form>
<?php
} else {
    setErrorHeading('variables undefined');
    echo '<p>It seems that you did not enter an input sentence or did not select a search mode. It is also
    possible that you came to this page directly without first entering an input example.</p>';
    getPreviousPageMessage(1);
}

require "$root/php/footer.php";
include "$root/scripts/AnalyticsTracking.php";

if ($continueConstraints) : ?>
  <script src="<?php echo $home; ?>/js/tree-visualizer.js"></script>
  <script>
  $(document).ready(function() {
      $("#tree-output").treeVisualizer('<?php echo "$home/tmp/$id-pt.xml?$id-$time"; ?>');
  });
  </script>
<?php endif; ?>
</body>
</html>
