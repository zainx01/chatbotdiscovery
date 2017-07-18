/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var mysql = require('mysql');
var Regex = require('regex');
var syncSql = require('sync-sql');
var express = require('express'); // app server
var S = require('string');
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var logs = null;
var connection = null;
var inputText = null;
var outputText = null;
var regexTest = null;
var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-10-21',
  version: 'v1'
});


// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };
	//dbConnection = createDBConnection ();
  // Send the input to the conversation service

  conversation.message(payload, function(err, data) {
    if (err) {
      //return res.status(err.code || 500).json(err);
	  res.status(err.code >= 100 && err.code < 600 ? err.code : 500);
    }
	if (req.body.input != null) {
		inputText = req.body.input.text;
		//console.log("Input provided is => "+req.body.input.text);
	}
	outputText = null;
	//console.log(JSON.stringify(data));
	if ((data != null && data.intents[0]!= null  && data.intents[0].intent == "incident") || (data != null && data.entities[0]!= null && data.entities[0].entity == "incidents")) {
		
		if(inputText != null) {
			regexTest = inputText.match(/INC[0-9]+/i);
			//console.log(JSON.stringify(regexTest));
			if (regexTest != null) {
			
			 var incidentNumber = regexTest[0].trim();	
			 var sql = "Select * from incidents where incident_number = '"+incidentNumber+"';";
			 console.log("Query =>"+ sql);
			 var output = executeQuerySync(sql);
			
			console.log(sql);
			if (output != null) {
				if (output.data.rows!= null && output.data.rows.length > 0) {
					//console.log("in message orchestration");
					outputText = orchestrateBotResponseTextForIncident(output.data.rows,data.output.text);
				}
				if (output.data.rows.length == 0 && regexTest[0]!= null){
					//console.log("in not found message.");
					outputText = "Sorry, no result can be found against given incident number "+incidentNumber+". Please confirm given incident number.";
				} 
				
			} 
			}			
		}
		
	}
	
	if (data != null && data.entities != null && (data.intents[0]!= null  && data.intents[0].intent == "regions")){
		if ( data.entities[0] != null && (data.entities.length <=3 && data.entities[0].entity == "regions" || data.entities[0].entity == "sys-location")) {
		console.log(JSON.stringify(data));
		var regionName_1 = data.entities[1].value;
		//var regionName_2 = data.entities[1].entity.value;
		console.log("region name =>"+ regionName_1);
		if (regionName_1 != "region") {
		var sql = "Select * from incidents where region like '%"+regionName_1+"%';";
		console.log("Query =>"+ sql);
		var output = executeQuerySync(sql);
		
		
				if (output.data.rows!= null && output.data.rows.length >= 1) {
					//console.log("in message orchestration");
					outputText = orchestrateBotResponseTextForRegion(output.data.rows,data.output.text,regionName_1);
				}
				if (output.data.rows.length == 0){
					//console.log("in not found message.");
					if (regionName_1 != null)
					outputText = "Sorry, no result can be found against given region "+regionName_1;
				}
		} else {
			outputText = "Sorry, you haven't provided a region name.";
		}	
		//console.log(JSON.stringify(data));
	}
	}
	
	if (data != null && data.entities[0] != null &&  data.entities[0].entity == "corporate-customers") {
		var customerName = data.entities[0].value;
		console.log("customer name =>"+ customerName);
		if (customerName != null) {
			
			var sql = "Select * from mspi_ods where owner_customer like '%"+customerName+"%';";
			var output = executeQuerySync(sql);
			var regionName = null;
			if (output.data.rows!= null && output.data.rows.length >= 1) {
				regionName = output.data.rows[0].region;
			
				sql = "Select * from incidents where region like '%"+regionName+"%';";
				console.log("Query =>"+ sql);
				output = executeQuerySync(sql);
				if (output.data.rows!= null && output.data.rows.length >= 1) {
					
					outputText = orchestrateBotResponseTextForCustomer(output.data.rows,data.output.text);
				}
			}
			if (output.data.rows.length == 0){
					//console.log("in not found message.");
					
					outputText = "Sorry, i could not find any incident(s) associated to customer "+customerName;
				}
			//console.log(JSON.stringify(output.data.rows));
			
		}
		
	}
	if (data != null && data.intents[0]!= null && data.intents[0].intent == "tier-cause-transmission-failure" || (data != null && data.entities[0]!= null && data.entities[0].entity == "transmission-failures")) {
		
			console.log(JSON.stringify(data.entities[0].value));
			var tier_cause_search_term = null;
			if (data.entities[0]!=null && data.entities[0].value != null){
				tier_cause_search_term = data.entities[0].value;
			}
			var sql = "Select * from incidents where tier_cause like '%"+tier_cause_search_term+"%';";
			 var output = executeQuerySync(sql);
			
			console.log(sql);
			if (output != null) {
				if (output.data.rows!= null && output.data.rows.length > 0) {
					//console.log("in message orchestration");
					outputText = orchestrateBotResponseTextForTransmissionFailures(output.data.rows,data.output.text);
				}
				if (output.data.rows.length == 0){
					//console.log("in not found message.");
					outputText = "Sorry, no incidents have been found because of "+tier_cause_search_term;
				} 
				
			} 
	
	}
	/*if (data != null && data.intents.intent == "escalation") {
		
		console.log(JSON.stringify(data));
	}*/
	
	
	
		
		// region part here
		
		
		
		//console.log(data.output.text);
    return res.json(updateMessage(payload, data));

	
 
});

   
});


function connectDb(){
	mysql_pool.getConnection(function(err, connection) {
		if (err) {
			connection.release();
	  		console.log(' Error getting mysql_pool connection: ' + err);
	  		throw err;
	  	} else {
			console.log ('Connection Established .... ');
		}
		
	});
}

function executeQuerySync(sql) {
	
	

var output = syncSql.mysql(
    {
       host: process.env.DB_HOST,
	   user: process.env.DB_USER,
	   password: process.env.DB_PWD,
	   database: process.env.DB_NAME,
       port: '3306'
    },
    sql
);
	
	return output;
}

/*
	Orchestration Layer Methods 
*/


function orchestrateBotResponseTextForIncident (dbQueryResult,outputText) {
	console.log("orchestrateBotResponseTextForRegion = >Length of rows =>"+dbQueryResult.length);
	if (dbQueryResult != null && dbQueryResult.length == 1) {
		
		outputText = S(outputText).replaceAll('[impact]', "<b>"+dbQueryResult[0].impact+"</b>").s;
		outputText = S(outputText).replaceAll('[region]', "<b>"+dbQueryResult[0].region+"</b>").s;
		outputText = S(outputText).replaceAll('[site_name]', "<b>"+dbQueryResult[0].site_name+"</b>").s;
		outputText = S(outputText).replaceAll('[status]', "<b>"+dbQueryResult[0].status+"</b>").s;
		outputText = S(outputText).replaceAll('[assigned_to]', "<b>"+dbQueryResult[0].task_assigned+"</b>").s;
		
	}
	return outputText;
}
function orchestrateBotResponseTextForRegion (dbQueryResult,outputText,regionName_2) {
	
		console.log("orchestrateBotResponseTextForRegion = >Length of rows =>"+dbQueryResult.length);
		if (dbQueryResult != null && dbQueryResult.length == 1) {
			outputText = S(outputText).replaceAll('[impact]', "<b>"+dbQueryResult[0].impact+"</b>").s;
			outputText = S(outputText).replaceAll('[region]', "<b>"+dbQueryResult[0].region+"</b>").s;
			outputText = S(outputText).replaceAll('[site_name]', "<b>"+dbQueryResult[0].site_name+"</b>").s;
			outputText = S(outputText).replaceAll('[status]', "<b>"+dbQueryResult[0].status+"</b>").s;
			outputText = S(outputText).replaceAll('[assigned_to]', "<b>"+dbQueryResult[0].task_assigned+"</b>").s;
		} else {
			outputText = "Yes, "+regionName_2+" has "+dbQueryResult.length+" service/visibility affecting tickets at the moment.";
			if (dbQueryResult.length > 25) {
			outputText +="Please see details below for 10 incidents only. <br/>";
			} else {
			outputText +="Please see details below <br/>";
			}
			outputText += "<table>";
			outputText += "<tr><th>INCIDENT NUMBER</th></tr>";
			for (i =0; i < dbQueryResult.length; i++) {
				
				if (i > 10) {
					break;
				}
				outputText += "<tr><td>"+dbQueryResult[i].incident_number+"</td></tr>";
				
			}
			outputText += "</table>";
		}
	return outputText;
}
function orchestrateBotResponseTextForCustomer (dbQueryResult,outputText) {
	
		console.log("orchestrateBotResponseTextForCustomer = >Length of rows =>"+dbQueryResult.length);
		if (dbQueryResult != null && dbQueryResult.length == 1) {
			outputText = S(outputText).replaceAll('[impact]', "<b>"+dbQueryResult[0].impact+"</b>").s;
			outputText = S(outputText).replaceAll('[region]', "<b>"+dbQueryResult[0].region+"</b>").s;
			outputText = S(outputText).replaceAll('[site_name]', "<b>"+dbQueryResult[0].site_name+"</b>").s;
			outputText = S(outputText).replaceAll('[status]', "<b>"+dbQueryResult[0].status+"</b>").s;
			outputText = S(outputText).replaceAll('[assigned_to]', "<b>"+dbQueryResult[0].task_assigned+"</b>").s;
		}
	return outputText;	
}
function orchestrateBotResponseTextForTransmissionFailures (dbQueryResult,outputText) {
	
	console.log("orchestrateBotResponseTextForTransmissionFailures = >Length of rows =>"+dbQueryResult.length);
	
		if (dbQueryResult != null && dbQueryResult.length >= 1) {
			outputText = S(outputText).replaceAll('[impact]', "<b>"+dbQueryResult[0].impact+"</b>").s;
			outputText = S(outputText).replaceAll('[region]', "<b>"+dbQueryResult[0].region+"</b>").s;
			outputText = S(outputText).replaceAll('[site_name]', "<b>"+dbQueryResult[0].site_name+"</b>").s;
			outputText = S(outputText).replaceAll('[status]', "<b>"+dbQueryResult[0].status+"</b>").s;
			outputText = S(outputText).replaceAll('[assigned_to]', "<b>"+dbQueryResult[0].task_assigned+"</b>").s;

			//outputText = Yes, there are several [tier_cause] issues e.g."Yes, "+regionName_2+" has "+dbQueryResult.length+" service/visibility affecting tickets at the moment.";
			if (dbQueryResult.length > 25) {
			outputText +=" .Please see details below for 10 incidents only. <br/>";
			} else {
			outputText +="Please see details below <br/>";
			}
			outputText += "<table>";
			outputText += "<tr><th>INCIDENT NUMBER</th></tr>";
			for (i =0; i < dbQueryResult.length; i++) {
				
				if (i > 10) {
					break;
				}
				outputText += "<tr><td>"+dbQueryResult[i].incident_number+"</td></tr>";
				
			}
		}	
			outputText += "</table>";
		
	return outputText;
}
function orchestrateBotResponseTextForShiftReports (dbQueryResult) {
	
	var responseText = "Yes, sure, this is a "+dbQueryResult[0].impact+ " issue in "+dbQueryResult[0].region+ " region for site "+dbQueryResult[0].site_name+ ". The status of this incident is "+dbQueryResult[0].status+ " and it has been assigned to "+dbQueryResult[0].task_assigned+ ".";
	
	return responseText;
}


 

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
	var responseText = null;
	if (response != null) {
	  if (!response.output) {
		response.output = {};
	  } else {
		//return response;
	  }
	  //console.log("update message method =>" + outputText);
	  if (outputText != null) {
		  response.output.text = outputText;
	  }
	}	  
	  outputText = null;
	return response;
}




module.exports = app;
