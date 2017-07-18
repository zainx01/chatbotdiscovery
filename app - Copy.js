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
var basicAuth = require('basic-auth-connect');
var uuid = require('uuid');
var vcapServices = require('vcap_services');
var cloudantUrl = null;
var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var logs = null;
var rowsReturnedByQuery = null;
var dbConnection = null;
var inputText = null;
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
      return res.status(err.code || 500).json(err);
    }
	if (dbConnection == null) {
		//createDBConnection();
	}
	if (req.body.input != null) {
		inputText = req.body.input.text;
		//console.log(req.body.input.text);
	}
    return res.json(updateMessage(payload, data));
 
});

   
});


function createDBConnection (){
	
	var connection = mysql.createConnection({
	  host: process.env.DB_HOST,
	  user: process.env.DB_USER,
	  password: process.env.DB_PWD,
	  database: process.env.DB_NAME,
	  connectTimeout  : 3600000
	  
	});
	
	connection.connect(function(err){
		if(!err) {
			console.log("Database is connected ... \n\n");    
		} else {
			console.log("Database disconnected ... \n\n");
			return null;    
		}
	});
	
	return connection;
}

function executeQuery (connection,sql) {
	
	connection.query(sql, function selectAll(err, rows,fields) {
	
		if (!err) {		
			
			console.log('Rows length is: ', rows.length);
			
			rowsReturnedByQuery = rows;	
		}
		else
		{
			console.log('Error while performing Query.');
			
		}
		
	 }); // query block ends here
}

function orchestrateBotResponseTextForIncident (dbQueryResult) {
	
	var responseText = "Yes, sure, this is a "+dbQueryResult[0].impact+ " issue in "+dbQueryResult[0].region+ " region for site "+dbQueryResult[0].site_name+ ". The status of this incident is "+dbQueryResult[0].status+ " and it has been assigned to "+dbQueryResult[0].task_assigned+ ".";
	
	return responseText;
}
function orchestrateBotResponseTextForRegion (dbQueryResult) {
	
	var responseText = "Yes, sure, this is a "+dbQueryResult[0].impact+ " issue in "+dbQueryResult[0].region+ " region for site "+dbQueryResult[0].site_name+ ". The status of this incident is "+dbQueryResult[0].status+ " and it has been assigned to "+dbQueryResult[0].task_assigned+ ".";
	
	return responseText;
}
function orchestrateBotResponseTextForCustomer (dbQueryResult) {
	
	var responseText = "Yes, sure, this is a "+dbQueryResult[0].impact+ " issue in "+dbQueryResult[0].region+ " region for site "+dbQueryResult[0].site_name+ ". The status of this incident is "+dbQueryResult[0].status+ " and it has been assigned to "+dbQueryResult[0].task_assigned+ ".";
	
	return responseText;
}
function orchestrateBotResponseTextForTransmissionFailures (dbQueryResult) {
	
	var responseText = "Yes, sure, this is a "+dbQueryResult[0].impact+ " issue in "+dbQueryResult[0].region+ " region for site "+dbQueryResult[0].site_name+ ". The status of this incident is "+dbQueryResult[0].status+ " and it has been assigned to "+dbQueryResult[0].task_assigned+ ".";
	
	return responseText;
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
	  if (!response.output) {
		response.output = {};
	  } else {
		//return response;
	  }
	
	var rows = null;
	
	
	
	if (dbConnection == null) {
		//createDBConnection();
	}
		console.log("Getting List of Actions from DB.");
		//var regex = new Regex(/(INC)([0-9])/g);
		//regex.test(inputText);
		var test = null;
		if(inputText != null) {
			test = inputText.match(/INC[0-9]+/i);
			if (test != null) {
				console.log("input is => "+test[0]);
				//var sql = "Select * from incidents where incident_number = '"+test[0]+"';";	
				//executeQuery (dbConnection,sql);
			} 
				
			
		}

	//dbConnection.end();
    if (rowsReturnedByQuery!= null) {
		response.output.text = orchestrateBotResponseTextForIncident(dbQueryResult);
	}else{
		if (test != null)
		response.output.text = "Sorry, no result can be found against given incident number "+test[0]+". Please confirm if the provided incident number is correct.";
	} 
	return response;
}


module.exports = app;
