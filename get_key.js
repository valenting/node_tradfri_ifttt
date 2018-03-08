const tradfriLib = require("node-tradfri-client");
const TradfriClient = tradfriLib.TradfriClient;
const nodeCleanup = require('node-cleanup');

nodeCleanup(function (exitCode, signal) {
  console.log("Cleaning up...");
  if (tradfri) {
    console.log("Destroying tradfri connection");
    tradfri.destroy();
  }
  tradfri = undefined;
});

var stdin = process.openStdin();
var tradfri;
stdin.addListener("data", function(d) {
    // note:  d is an object, and when converted to a string it will
    // end with a linefeed.  so we (rather crudely) account for that
    // with toString() and then trim()
    var input = d.toString().trim();
    console.log("you entered: [" + input + "]");
    if (state == 0) {
      tradfri = new TradfriClient(input);
      console.log("input the security code printed on the gateway");
      state = 1;
    } else {
      tradfri.authenticate(input)
             .then(result => {
                   console.log(result);
                   process.exit(0); });
    }
});

var state = 0;
console.log("input the gateway IP");