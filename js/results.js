/**
 * Documentation loosely based on the JSDoc standard
 */
$(document).ready(function() {
    // Customizable attributes!
    // Specify how long it should take for functions to session
    // * Before counting ALL hits, independent of current fetched results (ms)
    // * Before ALL results are being gathered on the background (ms), OR
    // * Amount of hits before ALL results are being gathered (hits)
    var timeoutBeforeMore = 500,
        xResultsBeforeMore = 4;

    var hash = window.location.hash,
        $window = $(window),
        tvLink = $("a.tv-show-fs"),
        controls = $(".controls"),
        resultsWrapper = $(".results-wrapper"),
        filterWrapper = $(".filter-wrapper"),
        messages = $(".messages"),
        dummy = $(".dummy-controls");

    var xhrAllSentences,
        resultID = 0,
        resultsCount = 0,
        done = false,
        doneCounting = false;

    getSentences();

    function getSentences() {
        if (!done && (resultID <= phpVars.resultsLimit)) {
            $(".loading-wrapper.searching").addClass("active");
            $.ajax(phpVars.fetchResultsPath)
                .done(function(json) {
                    if (!done) {
                        var data = $.parseJSON(json);
                        resultsWrapper.find("tbody:not(.empty) .added").removeClass("added");
                        if (!data.error && data.data) {
                            loopResults(data.data, false);
                        } else {
                            $(".loading-wrapper.searching").removeClass("active");
                            resultsWrapper.find("tbody:not(.empty) .added").removeClass("added");
                            $(".messages").addClass("active").children("div").removeClass("error notice");
                            if (data.error) {
                                messageOnError(data.data)
                            } else if (resultsWrapper.find("tbody:not(.empty)").children().length == 0) {
                                messageNoResultsFound();
                            } else {
                                messageAllResultsFound();
                                clearTimeout(findAllTimeout);
                            }

                            done = true;
                            if (xhrAllSentences) xhrAllSentences.abort();
                        }
                    }
                })
                .fail(function(jqXHR, textStatus, error) {
                    // Edge triggers a fail when an XHR request is aborted
                    // We don't want that, so if the error message is abort, ignore
                    if (error != 'abort') {
                        var string = "An error occurred";
                        if (error != '') string += ": " + error + ".";

                        messageOnError(string);
                    }
                })
                .always(function() {
                    if ((resultID == xResultsBeforeMore) && !done) {
                        findAll();
                    }
                });
        }
    }
    var findAllTimeout = setTimeout(function() {
        findAll();
    }, timeoutBeforeMore);

    function findAll() {
      if (xhrAllSentences) return;
        xhrAllSentences = $.ajax(phpVars.getAllResultsPath)
            .done(function(json) {
                var data = $.parseJSON(json);
                resultsWrapper.find("tbody:not(.empty) .added").removeClass("added");
                if (!data.error && data.data) {
                    loopResults(data.data, true);

                    clearTimeout(findAllTimeout);
                } else {
                    $(".loading-wrapper.searching").removeClass("active");
                    $(".messages").addClass("active").children("div").removeClass("error notice");
                    if (data.error) {
                        messageOnError(data.data);
                    } else if (resultsWrapper.find("tbody:not(.empty)").children().length == 0) {
                        messageNoResultsFound();
                    }
                }
            })
            .fail(function(jqXHR, textStatus, error) {
                // Edge triggers a fail when an XHR request is aborted
                // We don't want that, so if the error message is abort, ignore
                if (error != 'abort') {
                    var string = "An error occurred: " + error + ".";
                    messageOnError(string);
                }
            })
            .always(function() {
                done = true;
            });
    }

    $.ajax(phpVars.fetchCountsPath)
        .done(function(json) {
            var data = $.parseJSON(json),
                sum = data[0],
                totalArray = data[1];

            resultsCount = sum;

            sum = numericSeparator(parseInt(sum));
            controls.find(".count strong + span").text(sum);
            messages.find(".amount-hits").text(sum);
            messages.find(".is-still-counting").remove();



            if (resultsCount > 0) {
                // Length of associative array (Object in JS)
                var size = Object.keys(totalArray).length;
                if (typeof totalArray !== 'undefined' && size > 0) {
                    for (var database in totalArray) {
                        var databaseString = database.split("_")[2],
                            componentHits = numericSeparator(parseInt(totalArray[database][0])),
                            componentTotal = numericSeparator(parseInt(totalArray[database][1]));

                        $(".distribution-wrapper tbody").append('<tr><td>' + databaseString + '</td><td>' + componentHits + '</td><td>' + componentTotal + '</td></tr>');
                    }
                    $(".distribution-wrapper").show();
                }
                if (resultsCount > phpVars.resultsLimit) {
                  messages.find(".is-restricted").show();
                }
            }
        })
        .fail(function() {
            if (error != 'abort') {
                var string = "An error occurred: " + error + ".";
                messageOnError(string);
            }
        })
        .always(function() {
            doneCounting = true;
        });

    /**
     * Converts an integer with four or more digits to a comma-separated string
     * @param {number} integer - Any (positive) integer
     * @example
     * // returns 1,234,567
     * numericSeparator(1234567);
     * @returns {string} Returns thhe string representation of the number.
     */
    function numericSeparator(integer) {
        if (Number.isInteger(integer) && integer > 999) {
            return integer.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
        }
        return integer;
    }

    function messageAllResultsFound() {
        disableAndEnableInputs();

        messages.load(phpVars.fetchHomePath + '/php/results-messages.php #results-found', function() {
          if (doneCounting) {
            messages.find(".amount-hits").html(resultsCount);
            messages.find(".is-still-counting").remove();
          }

          if (resultsCount > phpVars.resultsLimit || resultID == phpVars.resultsLimit) {
            messages.find(".is-restricted").show();
          }

          messages.addClass("active").children("div").removeClass("error").addClass("notice active");
          messages.find(".notice").one("transitionend", function() {
              setDummyVariables();
          });

          $("html, body").stop().animate({
              scrollTop: $("#results-section").offset().top,
          }, 250, function() {
              $window.scroll();
          });
        });
    }

    function messageNoResultsFound() {
        resultsWrapper.children("p").add(controls).add(dummy).remove();

        messages.load(phpVars.fetchHomePath + '/php/results-messages.php #no-results-found', function() {
          messages.addClass("active").children("div").removeClass("notice").addClass("error active");
        });
    }

    function messageOnError(error) {
        resultsWrapper.children("p").add(controls).add(dummy).remove();

        messages.load(phpVars.fetchHomePath + '/php/results-messages.php #error', function() {
          messages.find(".error-msg").text(error);
          messages.addClass("active").children("div").removeClass("notice").addClass("error active");
        });
    }

    function showTvFsOnLoad() {
        var tvLink = $("a.tv-show-fs"),
            hash = window.location.hash;
        if (hash && !$(".loading-wrapper.fullscreen").hasClass("active") && !$(".tree-visualizer-fs").is(":visible")) {
            if (hash.indexOf("tv-") == 1) {
                var index = hash.match(/\d+$/);
                tvLink.eq(index[0] - 1).click();
            }
        }
    }

    function loopResults(sentences, returnAllResults) {
        if (returnAllResults) {
            done = true;
            resultID = 0;

            resultsWrapper.find("tbody:not(.empty)").empty();
            $(".loading-wrapper.searching").removeClass("active");
        }
        $.each(sentences, function(id, value) {
            if (returnAllResults || (!returnAllResults && !done)) {
                resultID++;
                var link = value[0];
                link = link.replace(/\bhref=\"([^"]+)\"/, "href=\"#tv-" + resultID + "\" data-tv-url=\"$1\"");

                resultsWrapper.find("tbody:not(.empty)").append('<tr data-result-id="' + resultID + '" data-component="' + value[2] + '">' +
                    '<td>' + resultID + '</td><td>' + link + '</td><td>' +
                    value[2] + '</td><td>' + value[1] + '</td></tr>');
            }
            showTvFsOnLoad();
        });

        resultsWrapper.find(".table-wrapper").fadeIn("fast");
        resultIDString = numericSeparator(resultID);
        controls.find(".count strong").text(resultIDString);

        if (!returnAllResults) {
            getSentences();
        }
        else {
          messageAllResultsFound();
        }
    }

    controls.find("[name='go-to']").keyup(function(e) {
            var keycode = e.keyCode,
                $this = $(this);
            // Reset customValidity on backspace or delete keys, or up and down arrows
            // Additionally allow a user to move throguh rows by using up and down arrows in
            // the input field
            if (keycode == 8 || keycode == 46 || keycode == 38 || keycode == 40) {
                this.setCustomValidity("");
                // UP arrow
                if (keycode == 38 && $this.val() < resultID) $this.val(parseInt($this.val(), 10) + 1).change();
                // DOWN arrow
                if (keycode == 40 && $this.val() > 1) $this.val(parseInt($this.val(), 10) - 1).change();
            }
        })
        .change(function() {
            var val = $(this).val(),
                row = resultsWrapper.find("tbody:not(.empty) tr[data-result-id='" + val + "']");

            if (!row.is(":visible")) {
                this.setCustomValidity("Please choose a row that is visible. Some rows are hidden depending on the filters you set.");
            } else {
                this.setCustomValidity("");
                var offset = row.offset(),
                    hControls = $(".controls").outerHeight();

                $("html, body").stop().animate({
                    scrollTop: offset.top - hControls
                }, 150);
            }
        });

    $(".controls form").submit(function(e) {
        e.preventDefault();
    });

    $(".controls [name='filter-components']").change(function() {
        $(this).parent().toggleClass("active");
    });

    $(document).click(function(e) {
        if ($(".controls [for='filter-components']").hasClass("active")) {
            var target = $(e.target);
            if (!target.closest(".filter-wrapper, .controls [for='filter-components']").length) {
                $(".controls [for='filter-components']").removeClass("active");
            }
        }
    });

    $(".filter-wrapper [type='checkbox']").change(function() {
        var $this = $(this),
            component = $this.val();

        $("#all-components").prop("indeterminate", false);

        if ($this.is("[name='component']")) {
            // Show/hide designated components in results
            if ($this.is(":checked")) {
                resultsWrapper.find("tbody:not(.empty) tr[data-component='" + component + "']").show();
            } else {
                resultsWrapper.find("tbody:not(.empty) tr[data-component='" + component + "']").hide();
            }

            // If none of the component checkboxes are checked
            if (!filterWrapper.find("[name='component']").is(":checked")) {
                resultsWrapper.find(".empty").css("display", "table-row-group");
                filterWrapper.find("#all-components").prop("checked", false).parent().removeClass("active");
                $("[for='go-to']").addClass("disabled").children("input").prop("disabled", true);
            } else {
                if (filterWrapper.find("[name='component']:not(:disabled)").length == filterWrapper.find("[name='component']:not(:disabled):checked").length) {
                    filterWrapper.find("#all-components").prop("checked", true).parent().addClass("active");
                } else {
                    filterWrapper.find("#all-components").prop("checked", false).prop("indeterminate", true).parent().removeClass("active");
                }
                resultsWrapper.find(".empty").hide();
                $("[for='go-to']").removeClass("disabled").children("input").prop("disabled", false);
            }
        }
        // One checkbox to rule them all
        else if ($this.is("#all-components")) {
            $this.parent().toggleClass("active");
            filterWrapper.find("[type='checkbox'][name='component']:not(:disabled)").prop("checked", $this.is(":checked")).change();
        }

        $("#go-to").val(resultsWrapper.find("tbody:not(.empty) tr:visible").first().attr("data-result-id") || "--");
    });

    function disableAndEnableInputs() {
        $("[for='go-to'], [for='filter-components'], .filter-wrapper label").removeClass("disabled").children("input").prop("disabled", false);

        // Disable the checkboxes which don't have any results
        filterWrapper.find("[type='checkbox'][name='component']").each(function() {
            var $this = $(this),
                component = $this.val();

            if (resultsWrapper.find("tbody:not(.empty) tr[data-component='" + component + "']").length == 0) {
                $this.prop("disabled", true);
                $this.prop("checked", false);
                $this.parent("label").addClass("disabled");
            }
        });
    }

    var controlsTop = controls[0].getBoundingClientRect().top + controls.scrollTop(),
        controlsHeight = controls[0].getBoundingClientRect().height;

    dummy.height(controlsHeight);

    $window.resize($.throttle(250, setDummyVariables));
    $window.scroll($.throttle(250, scrollMenu));
    // Abort searching request, so we can start a new request more quickly
    window.addEventListener("beforeunload", function() {
        if (xhrAllSentences) xhrAllSentences.abort();
    });

    function setDummyVariables() {
        if (!controls.hasClass("scroll")) {
            controlsTop = controls.offset().top;
            controlsHeight = controls.outerHeight();
            dummy.height(controlsHeight);
        } else {
            controlsTop = dummy.offset().top;
        }
    }

    function scrollMenu() {
        if ($window.scrollTop() >= controlsTop) {
            dummy.show();
            controls.addClass("scroll");
        } else {
            dummy.hide();
            controls.removeClass("scroll");
        }
    }

    /* Tree visualizer */
    resultsWrapper.find("tbody").on("click", "a.tv-show-fs", function(e) {
        var $this = $(this);
        $(".loading-wrapper.tv").addClass("active");
        $("body").treeVisualizer($this.data("tv-url"), {
            normalView: false,
            initFSOnClick: true,
            fsFontSize: 12
        });
        e.preventDefault();
    });

    if (hash) {
        if (hash.indexOf("tv-") == 1) {
            messages.load(phpVars.fetchHomePath + '/php/results-messages.php #looking-for-tree', function() {
              messages.addClass("active").children("div").removeClass("error").addClass("notice active");
            });
        }
    }
});
