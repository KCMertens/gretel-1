/**
 * jQuery "plug-in" to convert an XML tree structure into a
 * plug-and-play HTML tree that allows user interaction.
 *
 * https://github.com/BramVanroy/tree-visualizer
 *
 * @version 0.3
 * @license MIT
 * @author Bram Vanroy
 */

(function($) {
    $.fn.treeVisualizer = function(xml, options) {
        var defaults = {
            normalView: true,
            nvFontSize: 12,
            fsView: true,
            fsFontSize: 14,
            sentence: "",
            initFSOnClick: false,
            extendedPOS: false
        };
        var args = $.extend({}, defaults, options);
        var instance = this,
            FS, SS,
            treeFS, treeSS, tooltipFS, tooltipSS,
            anyTree,
            anyTooltip,
            zoomOpts,
            sentenceContainer,
            fontFitSize, tooltipTimeout;
        var $window = $(window);

        var FSPadding = {
                top: 84,
                right: 36,
                bottom: 48,
                left: 36
            },
            FSTreePadding = {
                top: 12,
                right: 12,
                bottom: 12,
                left: 12
            };

        if (args.normalView || args.fsView) {
            instance.children(".tree-visualizer, .tree-visualizer-fs").remove();
            initVars();
            loadXML(xml);
        } else {
            console.error("Cannot initialize Tree Visualizer: either the container " +
                "does not exist, or you have set both normal and fullscreen view to " +
                "false, which does not make sense.");
        }

        if (!args.initFSOnClick) {
            // Show tree-visualizer-fs tree
            instance.find(".tv-show-fs").click(function(e) {
                anyTooltip.css("top", "-100%").children("ul").empty();
                if (typeof treeSS != "undefined") treeSS.find("a").removeClass("hovered");

                FS.fadeIn(250);

                fontFitSize = null;
                fontToFit();
                e.preventDefault();
            });
        }
        // Adjust scroll position
        anyTree.add($window).scroll(function() {
            tooltipPosition();
        });

        // Close fullscreen if a user clicks on an empty area
        FS.click(function(e) {
            var target = $(e.target);
            if (!target.closest(".tv-error, .tree, .tooltip, .zoom-opts-wrapper, .sentence").length) {
                FS.fadeOut(250, function() {
                    treeFS.find("a").removeClass("hovered");
                    removeError();
                });
                if (args.initFSOnClick) history.replaceState("", document.title, window.location.pathname + window.location.search);
            }
        });
        // Zooming
        zoomOpts.find("button").click(function() {
            var $this = $(this);
            if ($this.is(".close")) {
                FS.fadeOut(250, function() {
                    treeFS.find("a").removeClass("hovered");
                    removeError();
                });
                if (args.initFSOnClick) history.replaceState("", document.title, window.location.pathname + window.location.search);
            } else {
                clearTimeout(tooltipTimeout);
                fontSizeTreeFS($this.attr("class").match(/\b(zoom-[^\s]+)\b/)[0]);
                sizeTreeFS();
                var animationSpeed = treeFS.find("a.hovered").css("transition-duration") || 200;

                animationSpeed = (String(animationSpeed).indexOf("ms") > -1) ? parseFloat(animationSpeed) : (parseFloat(animationSpeed) * 1000);
                animationSpeed += 50;

                tooltipTimeout = setTimeout(function() {
                    tooltipPosition(true);
                }, animationSpeed);
            }
        });

        // Make the tree-visualizer-fs tree responsive
        if (args.fsView) {
            $window.on("resize", function() {

                if (treeFS.is(":visible")) {
                    sizeTreeFS
                }
            });
        }

        anyTree.on("click", "a", function(e) {
            var $this = $(this),
                listItem = $this.parent("li"),
                data = listItem.data(),
                tree = $this.closest(".tree"),
                treeLeafs = tree.find("a"),
                tooltipList = tree.next(".tooltip").children("ul");

            tooltipList.empty();
            treeLeafs.removeClass("hovered");
            $this.addClass("hovered");
            var i;
            for (i in data) {
                if (data.hasOwnProperty(i)) {
                    $("<li>", {
                        html: "<strong>" + i + "</strong>: " + data[i]
                    }).prependTo(tooltipList);
                }
            }
            tooltipPosition();

            e.preventDefault();
        });

        anyTree.on("mouseout", "a.hovered", function() {
            var $this = $(this);
            if ($this.closest(".tree").hasClass("small")) {
                $this.on("webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend", function() {
                    tooltipPosition(true);
                });
            }
        });

        anyTooltip.find("button").click(function() {
            var $this = $(this),
                tooltip = $this.parent(".tooltip"),
                tree = tooltip.prev(".tree"),
                treeLeafs = tree.find("a");

            tooltip.fadeOut(250);
            treeLeafs.removeClass("hovered");
        });

        function initVars() {
            var trees = [],
                tooltips = [],
                views = [];

            if (args.normalView) {
                instance.append('<div class="tree-visualizer"></div>');
                SS = instance.children(".tree-visualizer");
                var SSHTML = '<div class="tv-error" style="display: none"><p></p></div>' +
                    '<div class="tree" style="font-size: ' + args.nvFontSize + 'px;"></div>' +
                    '<aside class="tooltip" style="display: none"><ul></ul>' +
                    '<button><i class="fa fa-fw fa-times"></i></button></aside>';
                if (args.fsView) {
                    SSHTML += '<button class="tv-show-fs" title="Open the tree in full screen mode"><i class="fa fa-fw fa-arrows-alt"></i></button>';
                }
                SS.append(SSHTML);

                treeSS = SS.children(".tree");
                tooltipSS = SS.children(".tooltip");

                views.push(SS);
                trees.push(treeSS);
                tooltips.push(tooltipSS);
            }
            if (args.fsView) {
                instance.append('<div class="tree-visualizer-fs" style="display: none"></div>');
                FS = instance.children(".tree-visualizer-fs");
                var FSHTML = "";
                if (!args.normalView) {
                    FSHTML += '<div class="tv-error" style="display: none"><p></p></div>';
                }
                FSHTML += '<div class="tree" style="font-size: ' + args.fsFontSize + 'px;"></div>' +
                    '<aside class="tooltip" style="display: none"><ul></ul>' +
                    '<button><i class="fa fa-fw fa-times"></i></button></aside><div class="zoom-opts-wrapper"><a href="' + xml + '" target="_blank" title="Show XML">Show XML</a>' +
                    '<div class="zoom-opts"><button class="zoom-out"><i class="fa fa-fw fa-search-minus" aria-hidden="true"></i></button>' +
                    '<button class="zoom-default">Default</button><button class="zoom-in"><i class="fa fa-fw fa-search-plus" aria-hidden="true"></i></button>' +
                    '<button class="close"><i class="fa fa-fw fa-times"></i></button></div></div>';

                FS.append(FSHTML);

                treeFS = FS.children(".tree");
                tooltipFS = FS.children(".tooltip");
                zoomOpts = FS.find(".zoom-opts");

                if (args.sentence != "") {
                    treeFS.before('<div class="sentence">' + decodeURI(args.sentence) + '</div>');
                    sentenceContainer = FS.children(".sentence");
                }

                views.push(FS);
                trees.push(treeFS);
                tooltips.push(tooltipFS);
                FS.css({
                    "padding-top": FSPadding.top,
                    "padding-right": FSPadding.right,
                    "padding-bottom": FSPadding.bottom,
                    "padding-left": FSPadding.left
                });
                treeFS.css({
                    "padding-top": FSTreePadding.top,
                    "padding-right": FSTreePadding.right,
                    "padding-bottom": FSTreePadding.bottom,
                    "padding-left": FSTreePadding.left
                });
            }
            anyTree = jqArrayToJqObject(trees);
            anyTooltip = jqArrayToJqObject(tooltips);
            anyView = jqArrayToJqObject(views);

            errorContainer = anyView.children(".tv-error");
        }

        function loadXML(src) {
            $.ajax({
                    type: "GET",
                    url: src,
                    dataType: "xml",
                    cache: false
                })
                .done(function(data) {
                    if (data == null) {
                        errorHandle("Your XML appears to be empty or not in a compatible format.");
                    } else {
                        parseXMLObj(data);
                    }
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    var msg = '';
                    if (jqXHR.status === 0) {
                        msg = 'Not connect to the Internet.<br>Verify your network connection.';
                    } else if (jqXHR.status == 404) {
                        msg = 'Requested XML file not found.<br>Try again with another query.';
                    } else if (jqXHR.status == 500) {
                        msg = 'Internal Server Error.<br>If the problem persists, contact us.';
                    } else {
                        msg = 'Uncaught Error.<br>Please try again at another time.';
                        msg += jqXHR.status + ' ' + textStatus + ' ' + errorThrown;
                    }
                    errorHandle(msg);
                })
                .always(function() {
                    if (args.normalView) {
                        instance.addClass("active");
                    }
                    if (args.initFSOnClick) {
                        $(".loading-wrapper.tv").removeClass("active");
                        FS.fadeIn(250, function() {
                            fontFitSize = null;
                            fontToFit();
                        });
                    }
                });
        }

        function parseXMLObj(xml) {
            var xmlObject = $(xml);

            removeError();

            // See the buildOutputList function below
            anyTree.html(buildOutputList(xmlObject.find("node").first()));

            // Empty tooltips
            anyTooltip.children("ul").empty();

            // Do some small tree modifications
            treeModifier();
        }

        // Build the HTML list output
        function buildOutputList(nodes) {
            var newList = $("<ol/>");

            nodes.each(function(x, e) {
                var newItem = $('<li><a href="#"></a></li>');

                for (var i = 0, l = e.attributes.length, a = null; i < l; i++) {
                    // Don't forget to add properties as data-attributes
                    a = e.attributes[i];
                    // Some data-attributes have initial spaces. Get rid of them
                    if (a.nodeName == "highlight") {
                        newItem.addClass("highlight");
                    } else {
                        if (a.nodeName != "begin" && a.nodeName != "end") {
                            newItem.attr("data-" + a.nodeName, a.value.replace(/^\s(.+)/g, "$1"));
                        }
                    }
                }
                if ($(this).children("node").length) {
                    newItem.append(buildOutputList($(this).children("node")));
                }
                newList.append(newItem);
            });
            return newList;
        }

        // Small modifications to the tree
        function treeModifier() {
            anyTree.find("a").each(function() {
                var $this = $(this),
                    li = $this.parent("li");

                if (li.data("rel")) {
                    $this.append("<span>" + li.data("rel") + "<span>");
                    if (li.data("index")) $this.append("<span>" + li.data("index") + "</span>");
                }

                if (li.data("postag") && args.extendedPOS) {
                    $this.append("<span>" + li.data("postag") + "</span>");
                } else if (li.data("pt")) {
                    if (li.data("index")) $this.children("span:last-child").append(":" + li.data("pt"));
                    else $this.append("<span>" + li.data("pt") + "</span>");
                } else if (li.data("cat")) {
                    if (li.data("index")) $this.children("span:last-child").append(":" + li.data("cat"));
                    else $this.append("<span>" + li.data("cat") + "</span>");
                }

                if ($this.is(":only-child")) {
                    if (li.data("lemma")) li.append("<span>" + li.data("lemma") + "</span>");
                    if (li.data("word")) li.append("<span><em>" + li.data("word") + "</em></span>");
                    // addClass because after appending new children, it isn't necessarily the
                    // only child any longer
                    $this.addClass("only-child");
                }
            });

            anyTree.find("li:only-child").addClass("only-child");
            anyTree.find("li:first-child").addClass("first-child");
            anyTree.find("li:last-child").addClass("last-child");
        }

        function noMoreZooming() {
            var currentFontSize = parseInt(treeFS.css("fontSize"), 10);
            if (currentFontSize <= 4) {
                zoomOpts.find("button.zoom-out").prop("disabled", true);
            } else if (currentFontSize >= 20) {
                zoomOpts.find("button.zoom-in").prop("disabled", true);
            } else {
                zoomOpts.find("button").prop("disabled", false);
                treeFS.removeClass("small x-small");
            }

            if (currentFontSize <= 8) {
                treeFS.addClass("small");
                if (currentFontSize <= 4) {
                    treeFS.addClass("x-small");
                }
            }
        }

        function fontSizeTreeFS(mode) {
            if (mode == 'zoom-default') {
                fontFitSize = null;
                fontToFit();
            } else {
                var currentFontSize = parseInt(treeFS.css("fontSize"), 10);
                if (mode == 'zoom-in') {
                    treeFS.css("fontSize", currentFontSize + 2 + "px");
                } else if (mode == 'zoom-out') {
                    treeFS.css("fontSize", currentFontSize - 2 + "px");
                }
            }
            noMoreZooming();
        }

        function fontToFit() {
            var currentFontSize = parseInt(treeFS.css("fontSize"), 10),
                el = treeFS[0],
                scrollw = el.scrollWidth,
                scrollh = el.scrollHeight,
                w = treeFS.outerWidth(),
                h = treeFS.outerHeight();
                console.log("called");
            if (((scrollh > h) || (scrollw > w)) && (currentFontSize > 1)) {
              console.log("large");
              console.log(scrollh + " " + h);
                if (fontFitSize == null) fontFitSize = "large";
                treeFS.css("fontSize", currentFontSize - 1 + "px");
                sizeTreeFS();
                if (fontFitSize == "large") fontToFit();
            } else if (fontFitSize != "large") {
                if (fontFitSize == null) fontFitSize = "small";
                treeFS.css("fontSize", currentFontSize + 1 + "px");
                console.log(fontFitSize + currentFontSize);
                sizeTreeFS();
                fontToFit();
            }
        }

        function tooltipPosition(animate) {
            var tree;
            if (typeof treeFS != "undefined" && treeFS.is(":visible")) {
                tree = treeFS;
            } else if (typeof treeSS != "undefined" && treeSS.is(":visible")) {
                tree = treeSS;
            }
            if (typeof tree != "undefined") {
                var targetLink = tree.find("a.hovered");
                if (targetLink.length) {
                    var tooltip = tree.next(".tooltip"),
                        targetRect = targetLink[0].getBoundingClientRect(),
                        treeRect = tree[0].getBoundingClientRect(),
                        linkV = {
                            top: targetRect.top,
                            right: targetRect.left + treeRect.width,
                            bottom: targetRect.top + treeRect.height,
                            left: targetRect.left,
                            w: targetRect.width,
                            h: targetRect.height
                        },
                        treeV = {
                            top: treeRect.top,
                            right: treeRect.left + treeRect.width,
                            bottom: treeRect.top + treeRect.height,
                            left: treeRect.left,
                            w: treeRect.width,
                            h: treeRect.height
                        };
                    if (animate) {
                        tooltip.stop(true).animate({
                            "left": parseInt(linkV.left + (linkV.w / 2) - (tooltip.outerWidth() / 2) + 7.5, 10),
                            "top": parseInt(linkV.top - tooltip.outerHeight() - 24, 10)
                        }, 250);
                    } else {
                        tooltip.css({
                            "left": parseInt(linkV.left + (linkV.w / 2) - (tooltip.outerWidth() / 2) + 7.5, 10),
                            "top": parseInt(linkV.top - tooltip.outerHeight() - 24, 10)
                        });
                    }


                    if (((linkV.left + (linkV.w / 2)) < treeV.left) ||
                        ((linkV.right + (linkV.w / 2)) < treeV.right) ||
                        ((linkV.top + (linkV.h / 2)) < treeV.top) ||
                        ((linkV.bottom + linkV.h) < treeV.bottom)) {
                        tooltip.fadeOut(400);
                    } else {
                        tooltip.fadeIn(250);
                    }
                }
            }
        }

        function sizeTreeFS() {
            var rect = treeFS.children("ol")[0].getBoundingClientRect();

            treeFS.css({
                "width": rect.width + FSTreePadding.right + FSTreePadding.left,
                "height": rect.height + FSTreePadding.top + FSTreePadding.bottom,
                "max-width": $window.width() - FSPadding.right - FSPadding.left,
                "max-height": $window.height() - FSPadding.top - FSPadding.bottom
            });

            if (args.sentence != "") {
                treeFS.css("max-height", $window.height() - FSPadding.top - FSPadding.bottom - (sentenceContainer[0].getBoundingClientRect().height * 2));
                sentenceContainer.css("max-width", treeFS[0].getBoundingClientRect().width);
            }

        }

        function errorHandle(message) {
            errorContainer.children("p").html(message).parent().fadeIn(250);
            if (args.normalView) {
                treeSS.hide();
                SS.children(".tv-show-fs").prop("disabled", true).hide();
            }
            if (args.fsView) treeFS.hide();
        }

        function removeError() {
            errorContainer.hide();
            treeFS.show();
            if (args.normalView) {
                SS.children(".tv-show-fs").prop("disabled", false).show();
            }
        }

        function jqArrayToJqObject(arr) {
            //http://stackoverflow.com/a/11304274/2919731
            return $($.map(arr, function(el) {
                return el.get();
            }));
        }
    }
}(jQuery));
