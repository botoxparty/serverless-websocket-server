"use strict";

const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

const CONNECTION_DB_TABLE = process.env.CONNECTION_DB_TABLE;

const successfullResponse = {
  statusCode: 200,
  body: "Success",
};

const failedResponse = (statusCode, error) => ({
  statusCode,
  body: error,
});

module.exports.connectHandler = (event, context, callback) => {
  addConnection(event.requestContext.connectionId)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch((err) => {
      callback(failedResponse(500, JSON.stringify(err)));
    });
};

module.exports.disconnectHandler = (event, context, callback) => {
  deleteConnection(event.requestContext.connectionId)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch((err) => {
      console.log(err);
      callback(failedResponse(500, JSON.stringify(err)));
    });
};

module.exports.defaultHandler = (event, context, callback) => {
  callback(null, failedResponse(404, "No event found"));
};

module.exports.broadcastHandler = (event, context, callback) => {
  sendMessageToAllConnected(event)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch((err) => {
      callback(failedResponse(500, JSON.stringify(err)));
    });
};

const sendMessageToAllConnected = (event) => {
  return getAllConnections().then((connectionData) => {
    return connectionData.Items.map((connectionId) => {
      return send(event, connectionId.connectionId);
    });
  });
};

const getAllConnections = () => {
  const params = {
    TableName: CONNECTION_DB_TABLE,
    ProjectionExpression: "connectionId",
  };

  return dynamo.scan(params).promise();
};

const send = (event, connectionId) => {
  const body = JSON.parse(event.body);
  let postData = body.data;
  console.log("Sending.....");

  if (typeof postData === Object) {
    console.log("It was an object");
    postData = JSON.stringify(postData);
  } else if (typeof postData === String) {
    console.log("It was a string");
  }

  const endpoint =
    event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint,
  });

  const params = {
    ConnectionId: connectionId,
    Data: postData,
  };
  return apigwManagementApi.postToConnection(params).promise();
};

const addConnection = (connectionId) => {
  const params = {
    TableName: CONNECTION_DB_TABLE,
    Item: {
      connectionId: connectionId,
    },
  };

  return dynamo.put(params).promise();
};

const deleteConnection = (connectionId) => {
  const params = {
    TableName: CONNECTION_DB_TABLE,
    Key: {
      connectionId: connectionId,
    },
  };

  return dynamo.delete(params).promise();
};
