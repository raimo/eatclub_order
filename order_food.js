var casper = require('casper').create({
//    verbose: true,
//    logLevel: 'debug',
    pageSettings: {
         loadImages:  true,         // The WebPage instance used by Casper will
         loadPlugins: true,         // use these settings
         localToRemoteUrlAccessEnabled: true,
         userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.4 (KHTML, like Gecko) Chrome/22.0.1229.94 Safari/537.4'
    }
});
var fs = require('fs');
var options = JSON.parse(fs.read('.eatclubrc'));

console.log("Using food preferences: " + JSON.stringify(options.preferences));

casper.on('complete.error', function(msg,backtrace) {
   this.echo('some error: ' + msg);
});

// print out all the messages in the headless browser context
casper.on('remote.message', function(msg) {
   this.echo('Remote message caught: ' + msg);
});
// print out all the messages in the headless browser context
casper.on("page.error", function(msg, trace) {
    this.echo("Page Error: " + msg, "ERROR");
});

var url = 'https://www.eatclub.com';

casper.start(url + '/login/', function() {
   //this.echo(casper.getHTML('body'));
   this.fill('form', {
        email: options.eatclub_email,
        password: options.eatclub_password
    }, true);
});

for (var i = 1; i <= 5; i++) {

  // Use closure to preserve local value for current_day
  (function(current_day) {
    // Go to the day view of current_day
    casper.waitForSelector('.menu-days-container .day', function() {
      this.echo('------------ Processing day ' + current_day + ' ------------');
      casper.thenEvaluate(function(current_day) {

        $('.menu-days-container .day:nth-child(' + current_day + ') .day-element:first').click();
      }, {current_day: current_day});
    });

    // wait until current_day's menu item is selected and require the checkmark to be hidden (indicates order hasn't been made yet)
    casper.waitForSelector('.menu-days-container .day.selected:nth-child(' + current_day + ')  > .day-box > .day-element .ordered-checkmark.ng-hide', function() {
      // wait for dishes to appear
      casper.waitForSelector('.mi-dish-tag', function() {

        // evaluate jQuery in the page
        casper.thenEvaluate(function(preferenceOptions){
          for (var i = 0; i < preferenceOptions.length; i++) {
            var expression = '[ec-menu-item][class=ng-scope]';
            if (preferenceOptions[i].include) {
              expression += ':contains(' + preferenceOptions[i].include + ')';
            }
            if (preferenceOptions[i].exclude) {
              expression += ':not(:contains(' + preferenceOptions[i].exclude + '))';
            }
            var candidates = $(expression);
            console.log('Food including "' + preferenceOptions[i].include + '" excluding "' + preferenceOptions[i].exclude + '" count: ' + candidates.length);
            if (candidates.length > 0) {
              var $selection = $('[ng-mouseover]:contains(ADD)', candidates.get(0));
              console.log('Picking ' + $selection.attr('item-name'));
              $selection.click();
              break;
            }
          }
        }, {preferenceOptions: options.preferences});
        casper.waitForSelector('.hitAdd_showCart #checkout-btn', function() {
          casper.evaluate(function(){
            // Hit Checkout!
            console.log('Making order!');
            $('.hitAdd_showCart #checkout-btn').click()
          });
          casper.waitForSelector('.menu-days-container .day:nth-child(' + current_day + ')  > .day-box > .day-element .ordered-checkmark:not(.ng-hide)', function() {
            this.echo('Order made successfully for day ' + current_day + '!');
          });
        }, function() {
          this.echo('No edible food, relying on meat backup for this day.');
        });

      });
    }, function () {
      this.echo('No order need to be done for day ' + current_day + '.');
    });
  })(i);
}

casper.run();
