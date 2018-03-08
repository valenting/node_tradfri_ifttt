require('dotenv').config();

const fs = require('fs');
const express = require('express');
const bodyParser= require('body-parser');
const path = require('path')
const app = express();

const tradfriLib = require("node-tradfri-client");
const nodeCleanup = require('node-cleanup');
const RGBColor = require('rgbcolor');

nodeCleanup(function (exitCode, signal) {
  console.log("Cleaning up...");
  if (tradfri) {
    console.log("Destroying tradfri connection");
    tradfri.destroy();
  }
  tradfri = undefined;
});

const TradfriClient = tradfriLib.TradfriClient;
var tradfri = new TradfriClient(process.env.HUBIP);

app.post('/api/:command/:id/:state', function(req, res) {
  if (req.query.password != process.env.PASS) {
    console.log("invalid password");
    res.status(403).send("wrong password");
    return;
  }

  var command = req.params.command;
  if (command == "turn" ||
      command == "dim" ||
      command == "temp" ||
      command == "color") {
    executeCommand(req.params.id, command, req.params.state);
    res.send("done");
    return;
  }

  console.log("unknown command", command);
  res.status(404).send("wrong command");
});

function performOperation(bulb, command, state)
{
  console.log(command, bulb.name, "(" + bulb.instanceId + ")", state);
  if (command == "turn") {
    tradfri.operateLight(bulb, {onOff: state == "on"});
  } else if (command == "dim") {
    tradfri.operateLight(bulb, {dimmer: state});
  } else if (command == "temp") {
    tradfri.operateLight(bulb, {colorTemperature: state});
  } else if (command == "color") {
    // Fixup color names into rgb value strings if necessary
    var color = new RGBColor(state);
    state = color.toHex().slice(1);
    tradfri.operateLight(bulb, {color: state});
  }
}

function executeCommand(id, command, state) {
  // When the id gets passed as "the living room" turn it into "living room"
  // Also "all the" gets turned into all.
  id = id.replace(/the/g, "").trim().toLowerCase();

  // If it's just "all" then we set it to the empty string, so we fall back
  // to setting every bulb (because every bulb name starts with empty string)
  if (id == "all") {
    id = "";
  }

  console.log("executeCommand", command, id, state);

  for (var groupId in groups) {
    var group = groups[groupId];
    if (group.name.toLowerCase() == id) {
      tradfri.operateGroup(group, {onOff: state == "on"});
      for (var deviceId of group.deviceIDs) {
        var bulb = lightbulbs[deviceId];
        if (bulb) { // skip non-bulbs
          performOperation(bulb, command, state);
        }
      }
      return;
    }
  }

  for (var bulbid in lightbulbs) {
    var bulb = lightbulbs[bulbid];
    if (bulb.name.toLowerCase().startsWith(id)) {
      performOperation(bulb, command, state);
      // we don't return, so we can apply to all bulbs that share a naming convention
    }
  }
}

const lightbulbs = {};
function tradfri_deviceUpdated(device) {
    console.log("tradfri_deviceUpdated", device.instanceId, device.name)
    if (device.type === tradfriLib.AccessoryTypes.lightbulb) {
        // remember it
        lightbulbs[device.instanceId] = device;
    }
}

function tradfri_deviceRemoved(instanceId) {
  if (instanceId in lightbulbs) {
    console.log("tradfri_deviceRemoved", instanceId, lightbulbs[instanceId].name)
    delete lightbulbs[instanceId];
  }
}

const groups = {};
function tradfri_groupUpdated(group) {
    // remember it
    console.log("tradfri_groupUpdated", group.instanceId, group.name)
    groups[group.instanceId] = group;
}

app.listen(process.env.PORT, function() {
 console.log('Listening on port ' + process.env.PORT);
 tradfri.connect(process.env.APIUSER, process.env.APIKEY)
        .then(() => {
          tradfri.on("device updated", tradfri_deviceUpdated)
                 .on("device removed", tradfri_deviceRemoved)
                 .observeDevices();
          tradfri.on("group updated", tradfri_groupUpdated)
                 .observeGroupsAndScenes();
        });
});
