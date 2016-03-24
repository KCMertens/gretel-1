<script>
function goBack() {
    window.history.back()
}

$(document).ready(function() {
    <?php if($step > 1): ?>
    $(".progressbar li:nth-child(-n+<?php echo $step-1;?>)").addClass("done");
    <?php endif ?>
    $(".progressbar li:nth-child(<?php echo $step;?>)").addClass("active");
});
</script>
<nav>
<ul class="progressbar">
  <li><p>1<span> - Example</span></p></li>
  <li><p>2<span> - Parse</span></p></li>
  <li><p>3<span> - Matrix</span></p></li>
  <li><p>4<span> - Treebank</span></p></li>
  <li><p>5<span> - Query</span></p></li>
  <li><p>6<span> - Results</span></p></li>
</ul>
<div id="ccl-logo">
<p>
    <strong>GrETEL 2.0</strong>
    <?php if ($step > 1) echo $sm . ' search mode'; ?>
</p>
<input type="button" value="Home" onclick="location.href = '../index.php'">
<a href="http://ccl.kuleuven.be" target="_blank"><img src="../img/ccl-logo-square.png" height="50"></img></a>
</div>
</nav>
