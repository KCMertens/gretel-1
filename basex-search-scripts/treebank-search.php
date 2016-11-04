<?php
function getMoreIncludes($database, &$databases, $session) {
    $xq = '/treebank/include';
    $xqinclude = 'db:open("' . $database . '")' . $xq;
    $query = $session->query($xqinclude);

    $basexinclude  = $query->execute();
    $basexincludes = explode("\n", $basexinclude);

    $query->close();

    $pattern = '/file=\"(.+)\"/';
    foreach ($basexincludes as $include) {
      if (!empty($include) && preg_match($pattern, $include, $files)) {
        $file = $files[1];

        if (!includeAlreadyExists($file)) {
          $databases[] = $file;
        }
      }
    }
}

function includeAlreadyExists($include) {
  session_start();
  $already = $_SESSION['already'];
  if (isset($already{$include})) {
    session_write_close();
    return true;
  } else {
    $already{$include} = 1;
    $_SESSION['already'] = $already;
    session_write_close();
    return false;
  }
}

function corpusToDatabase($components, $treebank)
{
    $databases = array();

    foreach ($components as $component) {
      $treebank = strtoupper($treebank);
      $component = strtoupper($component);
      $component = $treebank.'_ID_'.$component;
      $databases[] = $component;
    }

    return $databases;
}

function getSentences($xpath, $treebank, $subtreebank, $context, $endPosIteration, $session)
{
    global $flushLimit, $resultsLimit;
    $nrofmatches = 0;

    if ($endPosIteration !== 'all') {
        session_start();
        $leftOvers = $_SESSION['leftOvers'];
        session_write_close();
    }

    // If variable is set AND has a truth-y value
    if (isset($leftOvers) && $leftOvers) {
        foreach ($leftOvers as $key => $m) {
            ++$nrofmatches;

            $m = str_replace('<match>', '', $m);

            list($sentid, $sentence, $ids, $begins) = explode('||', $m);
            $sentid = trim($sentid);

            // Add unique identifier to avoid overlapping sentences w/ same ID
            $sentid .= '-endPos='.$endPosIteration.'+leftover='.$nrofmatches;

            $sentences{$sentid} = $sentence;
            $idlist{$sentid} = $ids;
            $beginlist{$sentid} = $begins;

            unset($leftOvers[$key]);

            if ($endPosIteration !== 'all') {
                if ($nrofmatches >= $flushLimit) {
                    break;
                }
            }
        }
    }

    if ($nrofmatches < $flushLimit) {
      // rename corpora to database names
      $databases = corpusToDatabase($subtreebank, $treebank);

      while ($db = array_pop($databases)) {
        while (1) {
          if ($endPosIteration !== 'all') ++$endPosIteration;

          $input = createXquery($xpath, $db, $treebank, false, $context, $endPosIteration);

          // create query instance
          $query = $session->query($input);

          // get results
          $match = $query->execute();
          $query->close();

          if (!$match || $match == 'false') {
            if ($endPosIteration !== 'all') $endPosIteration = 0;
            break;
          }

          // put matches into array
          $matches = explode('</match>', $match);

          // remove empty elements from array
          $matches = array_filter($matches);

          // make a hash of all matching sentences, count hits per sentence and append matching IDs per sentence
          $matchLength = count($matches);
          for ($i = 0; $i < $matchLength; ++$i) {
            if ($endPosIteration === 'all') {
                if ($nrofmatches >= $resultsLimit) {
                    break 3;
                }
            } else {
                if ($nrofmatches >= $flushLimit) {
                    $overflow = array_slice($matches, $i);
                    $leftOvers = array_merge($leftOvers, $overflow);
                    break 3;
                }
            }
            $m = $matches[$i];
            $m = str_replace('<match>', '', $m);
            list($sentid, $sentence, $ids, $begins) = explode('||', $m);

            if (isset($sentid, $sentence, $ids, $begins)) {
              ++$nrofmatches;

              $sentid = trim($sentid);

              // Add unique identifier to avoid overlapping sentences w/ same ID
              $sentid .= '-endPos='.$endPosIteration.'+match='.$nrofmatches;

              $sentences{$sentid} = $sentence;
              $idlist{$sentid} = $ids;
              $beginlist{$sentid} = $begins;
            }
          }
          if ($endPosIteration === 'all') break;
        }
      }
    }

    if (isset($sentences)) {
        if (isset($leftOvers) && !is_null($leftOvers)) {
            array_values(array_filter($leftOvers));
        } else {
            $leftOvers = array();
        }

        if ($endPosIteration !== 'all') {
          session_start();
          $_SESSION['leftOvers'] = $leftOvers;
          $_SESSION['endPosIteration'] = $endPosIteration++;
          session_write_close();
        }

        return array($sentences, $idlist, $beginlist);
    } else {
        // in case there are no results to be found
        return false;
    }
}

function getSentencesSonar($xpath, $treebank, $component, $includes, $context, $endPosIteration, $session) {
    global $flushLimit, $resultsLimit, $needRegularSonar;
    $nrofmatches = 0;

    if ($endPosIteration !== 'all') {
      session_start();
      $leftOvers = $_SESSION['leftOvers'];
      session_write_close();
    }

    if (isset($leftOvers) && !empty($leftOvers)) {
        foreach ($leftOvers as $key => $m) {
            ++$nrofmatches;

            $m = str_replace('<match>', '', $m);

            list($sentid, $sentence, $tb, $ids, $begins) = explode('||', $m);
            $sentid = trim($sentid);

            // Add unique identifier to avoid overlapping sentences w/ same ID
            $sentid .= '-endPos='.$endPosIteration.'+leftover='.$nrofmatches;

            $sentences{$sentid} = $sentence;
            $tblist{$sentid} = $tb;
            $idlist{$sentid} = $ids;
            $beginlist{$sentid} = $begins;

            unset($leftOvers[$key]);

            if ($endPosIteration !== 'all') {
                if ($nrofmatches >= $flushLimit) {
                    break;
                }
            }
        }
    }

    if ($nrofmatches < $flushLimit) {
      while ($db = array_pop($includes)) {
        if (!$needRegularSonar) {
          getMoreIncludes($db, $includes, $session);
        }

        while (1) {
          if ($endPosIteration !== 'all') ++$endPosIteration;

          $input = createXquery($xpath, $db, $treebank, $component, $context, $endPosIteration);

          // create query instance
          $query = $session->query($input);

          // get results
          $match = $query->execute();
          $query->close();

          if (!isset($match)) {
            if ($endPosIteration !== 'all') $endPosIteration = 0;
            break;
          }

          // put matches into array
          $matches = explode('</match>', $match);

          // remove empty elements from array
          $matches = array_filter($matches);

          // make a hash of all matching sentences, count hits per sentence and append matching IDs per sentence
          $matchLength = count($matches);
          for ($i = 0; $i < $matchLength; ++$i) {
            if ($endPosIteration === 'all') {
                if ($nrofmatches >= $resultsLimit) {
                    break 3;
                }
            } else {
                if ($nrofmatches >= $flushLimit) {
                    $overflow = array_slice($matches, $i);
                    $leftOvers = array_merge($leftOvers, $overflow);
                    break 3;
                }
            }
            $m = $matches[$i];
            $m = str_replace('<match>', '', $m);
            $m = trim($m);

            list($sentid, $sentence, $tb, $ids, $begins) = explode('||', $m);

            if (isset($sentid, $sentence, $tb, $ids, $begins)) {
              ++$nrofmatches;

              $sentid = trim($sentid);
              // Add unique identifier to avoid overlapping sentences w/ same ID
              $sentid .= '-endPos='.$endPosIteration.'+match='.$nrofmatches;

              $sentences{$sentid} = $sentence;
              $tblist{$sentid} = $tb;
              $idlist{$sentid} = $ids;
              $beginlist{$sentid} = $begins;
            }
          }
          if ($endPosIteration === 'all') break;
        }
      }
    }

    if (isset($sentences)) {
        if (isset($leftOvers) && !is_null($leftOvers)) {
            array_values(array_filter($leftOvers));
        } else {
            $leftOvers = array();
        }

        if ($endPosIteration !== 'all') {
          session_start();
          $_SESSION['leftOvers'] = $leftOvers;
          $_SESSION['endPosIteration'] = $endPosIteration++;
          if (!$needRegularSonar) {
            $_SESSION['includes'] = $includes;
          }
          session_write_close();
        }

        return array($sentences, $tblist, $idlist, $beginlist);
    }
}

function createXquery($xpath, $db, $treebank, $component, $context, $endPosIteration)
{
    global $flushLimit, $resultsLimit, $needRegularSonar;

    $for = 'for $node in db:open("'.$db.'")/treebank';
    if ($treebank == 'sonar' && !$needRegularSonar) {
        $for .= "/tree";
        $sentid = 'let $sentid := ($node/ancestor::tree/@id)';
        $sentence = '
    return
    for $sentence in (db:open("'.$component[0].'sentence2treebank")/sentence2treebank/sentence[@nr=$sentid])
        let $tb := ($sentence/@part)';
    }
    else {
        $sentid = 'let $sentid := ($node/ancestor::alpino_ds/@id)';
        $sentence = 'let $sentence := ($node/ancestor::alpino_ds/sentence)';
    }

    $regulartb = $needRegularSonar ? "let \$tb := '$db'" : '';
    $returnTb = ($treebank == 'sonar') ? '||{data($tb)}' : '';

    $ids = 'let $ids := ($node//@id)';
    $begins = 'let $begins := ($node//@begin)';
    $beginlist = 'let $beginlist := (distinct-values($begins))';
    if ($context && !$needRegularSonar) {
      if ($treebank == 'sonar') {
        $dbs = $component[0].'sentence2treebank';
      } else {
        $dbs = strtoupper($treebank).'_ID_S';
      }

        $text = 'let $text := fn:replace($sentid[1], \'(.+?)(\d+)$\', \'$1\')';
        $snr = 'let $snr := fn:replace($sentid[1], \'(.+?)(\d+)$\', \'$2\')';
        $prev = 'let $prev := (number($snr)-1)';
        $next = 'let $next := (number($snr)+1)';
        $previd = 'let $previd := concat($text, $prev)';
        $nextid = 'let $nextid := concat($text, $next)';

        $prevs = 'let $prevs := (db:open("'.$dbs.'")';
        $nexts = 'let $nexts := (db:open("'.$dbs.'")';

        if ($treebank != 'sonar') {
          $prevs .= '//s[id=$previd]/sentence)';
          $nexts .= '//s[id=$nextid]/sentence)';
        } else {
          $prevs .= '/sentence2treebank/sentence[@nr=$previd])';
          $nexts .= '/sentence2treebank/sentence[@nr=$nextid])';
        }

        $return = ' return <match>{data($sentid)}||{data($prevs)} <em>{data($sentence)}</em> {data($nexts)}'
            . $returnTb . '||{string-join($ids, \'-\')}||{string-join($beginlist, \'-\')}</match>';

        $xquery = $for.$xpath.$sentid.$sentence.$ids.$begins.$beginlist.$text.$snr.$prev.$next.$previd.$nextid.$prevs.$nexts.$return;
    } else {
        $return = ' return <match>{data($sentid)}||{data($sentence)}' . $returnTb
            . '||{string-join($ids, \'-\')}||{string-join($beginlist, \'-\')}</match>';
        $xquery = $for.$xpath.$sentid.$sentence.$regulartb.$ids.$begins.$beginlist.$return;
    }

    // Adds positioning values:; limits possible output
    $openPosition = '(';
    // Never fetch more than the resultsLimit, not even with all
    if ($endPosIteration == 'all') {
        $closePosition = ')[position() = 1 to '.$resultsLimit.']';
    }
    // Only fetch the given flushLimit, and increment on each iteration
    else {
        $endPosition = $endPosIteration * $flushLimit;
        $startPosition = $endPosition - $flushLimit + 1;
        $closePosition = ')[position() = '.$startPosition.' to '.$endPosition.']';
    }

    $xquery = $openPosition.$xquery.$closePosition;

    return $xquery;
}

function highlightSentence($sentence, $beginlist, $tag)
{
    if (strpos($sentence, '<em>') !== false) {
      preg_match("/(.*<em>)(.*?)(<\/em>.*)/", $sentence, $groups);
        $s = $groups[2];
        $prev = $groups[1];
        $next = $groups[3];
    } else {
        $s = $sentence;
    }
    $words = explode(' ', $s);
    $begins = explode('-',$beginlist);

    $i = 0;
    // Instead of wrapping each individual word in a tag, merge sequences
    // of words in one <tag>...</tag>
    foreach ($words as $word) {
        if (in_array($i, $begins)) {
            $val = '';
            if (!in_array($i-1, $begins)) {
                $val .= "<$tag>";
            }
            $val .= $words[$i];
            if (!in_array($i+1, $begins)) {
                $val .= "</$tag>";
            }
            $words[$i]= $val;
        }
        $i++;
    }
    $hlsentence = implode(' ', $words);
    if (isset($prev) || isset($next)) {
      $hlsentence = $prev.' '.$hlsentence.' '.$next;
    }
    return $hlsentence;
}

function getRegularSonar($component) {
  global $root;
  $includes = file("$root/treebank-parts/$component.lst");
  $includes = array_map("extractComponentTreebanks", $includes);

  return $includes;
}

function extractComponentTreebanks($line) {
  preg_match("/>(\w+)</", $line, $matches);
  return $matches[1];
}
