


const {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  GetItemCommand, // Retrieve data fron dynamoDb table
  ScanCommand,

} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
// Create a DynamoDB client for the specified AWS region
const client = new DynamoDBClient({ region: "ap-south-1" });
// Define regular expressions for validation
//validatins for name
const nameRegex = /^[A-Za-z]{3,32}$/;
//The customerNumber should be 11 digits only
const CustomerNumberRegex = /^\d{11}$/;
//BankAccountNumber should be minimum 11 and max 16 digits
const BankAccountNumber = /^\d{11,16}$/;
// Validation function for bankDetails object
const validation = (bankDetails) => {
  //bankname validation for minimum 3 characters
  if (!nameRegex.test(bankDetails.BankName)) {
    return "BankName should be minimum 3 characters!";
  }
  //branchName should be minimum 3 characters
  if (!nameRegex.test(bankDetails.BranchName)) {
    return "BranchName should be minimum 3 characters!";
  }
  //branchAddress should be minimum 3 characters
  if (!nameRegex.test(bankDetails.BranchAddress)) {
    return "BranchAddress should be minimum 3 characters!";
  }
  //customerNumber should be 11 characters
  if (!CustomerNumberRegex.test(bankDetails.CustomerNumber)) {
    return "CustomerNumber should be 11 characters!";
  }
  //bankDetails must be 11 digits
  if (!BankAccountNumber.test(bankDetails.BankAccountNumber)) {
    return "BankAccountNumber should be minimum 11 digits!";
  }
  return null; // Validation passed
};
// Function to create an employee
const bankDetailsAll = async (event) => {
  let response = { statusCode: 200 };
  const resource = event.resource;
  switch (resource) {
    case `/employee/bankDetails`:
      try {
        // Parse the JSON body from the event
        const body = JSON.parse(event.body);
        const bankDetails = body.bankDetails;
        console.log(bankDetails);
        // Perform validation on bankDetails
        const validationError = validation(bankDetails);
        if (validationError) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            message: validationError,
          });
          throw new Error(validationError);
        }
        //Check for required fields in the body
        const requiredBankDetails = [
          "BankName",
          "BranchName",
          "BranchAddress",
          "CustomerNumber",
          "BankAccountNumber",
          "IsSalaryAccount",
          "IsActive",
          "IsDeleted",
        ];
        //Iterate bankDetails to check mandatory fields
        for (const field of requiredBankDetails) {
          if (!body.bankDetails[field]) {
            response.statusCode = 400;
            throw new Error(`${field} is a mandatory field!`);
          }
        }
        //empId should be given mandatory
        if (!body.empId) {
          response.statusCode = 400;
          throw new Error("empId is a mandatory field!");
        }
        // Define parameters for inserting an item into DynamoDB
        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          //add the below line in params to validate post method to restrict duplicate posts
          ConditionExpression: "attribute_not_exists(empId)",
          Item: marshall({
            empId: body.empId,
            bankDetails: {
              BankName: bankDetails.BankName,
              BranchName: bankDetails.BranchName,
              BranchAddress: bankDetails.BranchAddress,
              CustomerNumber: bankDetails.CustomerNumber,
              BankAccountNumber: bankDetails.BankAccountNumber,
              IsSalaryAccount: bankDetails.IsSalaryAccount,
              IsActive: bankDetails.IsActive,
              IsDeleted: bankDetails.IsDeleted,
            },
          }),
        };
        // Insert the item into DynamoDB
        await client.send(new PutItemCommand(params));
        response.body = JSON.stringify({
          message: "Successfully created BankDetails!",
        });
      } catch (e) {
        // To through the exception if anything failing while creating bankDetails
        console.error(e);
        if (e.name === "ConditionalCheckFailedException") {
          response.statusCode = 400;
          response.body = JSON.stringify({
            message: "BankDetails Already Exists!",
            errorMsg: e.message,
          });
        } else {
          console.error(e);
          response.body = JSON.stringify({
            message: "Failed to update BankDetails.",
            errorMsg: e.message,
            errorStack: e.stack,
          });
        }
      }
      break;
    // Function to update an employee
    case `/employee/bankDetails/{empId}`:
      try {
        // Parse the JSON body from the event
        const body = JSON.parse(event.body);
        const objKeys = Object.keys(body);
        // Perform validation on bankDetails
        const validationError = validation(body.bankDetails);
        if (validationError) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            message: validationError,
          });
          throw new Error(validationError);
        }
        // Define parameters for updating an item in DynamoDB
        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Key: marshall({ empId: event.pathParameters.empId }),
          //add the below line in params to validate and restrict the put method (updates only if the attribute exists)
          ConditionExpression: "attribute_exists(empId)",
          UpdateExpression: `SET ${objKeys
            .map((_, index) => `#key${index} = :value${index}`)
            .join(", ")}`,
          ExpressionAttributeNames: objKeys.reduce(
            (acc, key, index) => ({
              ...acc,
              [`#key${index}`]: key,
            }),
            {}
          ),
          ExpressionAttributeValues: marshall(
            objKeys.reduce(
              (acc, key, index) => ({
                ...acc,
                [`:value${index}`]: body[key],
              }),
              {}
            )
          ),
        };
        // Update the item in DynamoDB
        const updateResult = await client.send(new UpdateItemCommand(params));
        response.body = JSON.stringify({
          message: "Successfully updated BankDetails.",
          updateResult,
        });
      } catch (e) {
        console.error(e);
        if (e.name === "ConditionalCheckFailedException") {
          response.statusCode = 400;
          response.body = JSON.stringify({
            message: "BankDetails not found!",
            errorMsg: e.message,
          });
        } else {
          console.error(e);
          response.body = JSON.stringify({
            message: "Failed to update BankDetails!",
            errorMsg: e.message,
            errorStack: e.stack,
          });
        }
      }
      break;
    case `/employee/bankDetails/get/{empId}`:
      try {
        // Define table name and employeeId key with its value
        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME, // Getting table name from the servetless.yml and setting to the TableName
          Key: marshall({ empId: event.pathParameters.empId }), // Convert a JavaScript object into a DynamoDB record.
        };
        //await response from db when sent getItem command with params
        //containing tablename, key and only display empId and bank details
        const { Item } = await client.send(new GetItemCommand(params)); //An asynchronous call to DynamoDB to retrieve an item
        console.log({ Item });
        if (!Item) {
          // If there is no employee bank details found
          response.statusCode = 404; // Setting the status code to 404
          response.body = JSON.stringify({
            message: "Employee bank details not found.",
          }); // Setting error message
        } else {
          // If employee bank details found in the dynamoDB set to data
          response.body = JSON.stringify({
            message: "Successfully retrieved Employee bank details.",
            data: unmarshall(Item), // A DynamoDB record into a JavaScript object and setting to the data
          });
        }
      } catch (e) {
        // If any errors will occurred
        console.error(e);
        response.body = JSON.stringify({
          statusCode: e.statusCode, // Set server side status code
          message: "Failed to retrieved employee bank details.",
          errorMsg: e.message, // Set error message
        });
      }
      break;
  }
  return response;
};
// Export the createEmployee and updateEmployee functions
module.exports = {
  bankDetailsAll,
};


///////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////










// // This program is for getting the employee bank details based http GET method.
// const {
//     DynamoDBClient, // Dynamodb instance
//     GetItemCommand, // Retrieve data fron dynamoDb table
//     ScanCommand, // Scan the table
//     PutItemCommand,
//   } = require("@aws-sdk/client-dynamodb"); //aws-sdk is used to build rest APIs
//   const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb"); // Importing marshall, unmarshall for Convert a JavaScript object into a DynamoDB record and a DynamoDB record into a JavaScript object
//   const client = new DynamoDBClient(); // Create new instance of DynamoDBClient to client, will use this constant across the program
  
//   const employeeBankDetailsAll = async (event) => {
//     const response = { statusCode: 200 };
    
//     try {
//       switch (event.httpMethod) {
//         case 'POST':
//           return createBankDetialsInfo;
//         case 'PUT':
//           return updateBankDetialsInfo;
//         case 'GET':
//           if (event.resource === '/getEmployeeBankDetialsInfo/{empId}') {
//             return getEmployeeBankDetialsInfo;
//           } else if (event.resource === '/getAllEmployeesBankDetialsInfo') {
//             return getAllEmployeesBankDetialsInfo;
//           }
//           break;
//         case 'DELETE':
//           if (event.resource === '/deleteBankDetialsInfo/{empId}') {
//             return deleteBankDetialsInfo
//           } else if (event.resource === '/softDeleteBankDetialsInfo/{empId}') {
//             return softDeleteBankDetialsInfo;
//           }
//           break;
//         default:
//           response.statusCode = 400; // Bad Request
//           response.body = JSON.stringify({ message: 'Invalid HTTP Method' });
//       }
//     } catch (error) {
//       console.error(error);
//       response.statusCode = 500; // Internal Server Error
//       response.body = JSON.stringify({ message: 'An error occurred' });
//     }
  
//     return response;
//   };

//   // This function for the get the employee bank details based on the employee id.
//   const getEmployeeBankDetialsInfo = async (event) => {
//     const response = { statusCode: 200 }; // Setting the default status code to 200
//     try {
//       // Define table name and empId key with its value
//       const params = {
//         TableName: process.env.DYNAMODB_TABLE_NAME, // Getting table name from the servetless.yml and setting to the TableName
//         Key: marshall({ empId: event.pathParameters.empId }), // Convert a JavaScript object into a DynamoDB record.
//       };
//       //await response from db when sent getItem command with params
//       //containing tablename, key and only display empId and bank details
//       const { Item } = await client.send(new GetItemCommand(params)); //An asynchronous call to DynamoDB to retrieve an item
//       console.log({ Item });
//       if (!Item) {
//         // If there is no employee bank details found
//         response.statusCode = 404; // Setting the status code to 404
//         response.body = JSON.stringify({
//           message: "Employee bank details not found.",
//         }); // Setting error message
//       } else {
//         // If employee bank details found in the dynamoDB set to data
//         response.body = JSON.stringify({
//           message: "Successfully retrieved Employee bank details.",
//           data: unmarshall(Item), // A DynamoDB record into a JavaScript object and setting to the data
//         });
//       }
//     } catch (e) {
//       // If any errors will occurred
//       console.error(e);
//       response.body = JSON.stringify({
//         statusCode: e.statusCode, // Set server side status code
//         message: "Failed to retrieved employee bank details.",
//         errorMsg: e.message, // Set error message
//       });
//     }
//     return response;
//   };
//   // This function for the get the all employees bank details.
//   const getAllEmployeesBankDetialsInfo = async () => {
//     const response = { statusCode: 200 }; // Setting the default status code to 200
//     try {
//       const { Items } = await client.send(
//         new ScanCommand({ TableName: process.env.DYNAMODB_TABLE_NAME })
//       ); // Getting table name from the servetless.yml and setting to the TableName
  
//       if (Items.length === 0) {
//         // If there is no employee bank details found
//         response.statusCode = 404; // Setting the status code to 404
//         response.body = JSON.stringify({
//           message: "Employee bank details not found.",
//         }); // Setting error message
//       } else {
//         // If employee bank details found in the dynamoDB setting the data
//         response.body = JSON.stringify({
//           message: "Successfully retrieved all Employees bank details.",
//           data: Items.map((item) => unmarshall(item)), // A DynamoDB record into a JavaScript object and setting to the data
//         });
//       }
//     } catch (e) {
//       // If any errors will occurred
//       console.error(e);
//       response.body = JSON.stringify({
//         statusCode: e.statusCode, // Handle any server response errors
//         message: "Failed to retrieved Employee bank details.",
//         errorMsg: e.message, // Handle any server response message
//       });
//     }
//     return response; //Return response with statusCode and data.
//   };





// // Define regular expressions for validation
// //validatins for name
// const nameRegex = /^[A-Za-z]{3,32}$/;
// //The customerNumber should be 11 digits only
// const CustomerNumberRegex = /^\d{11}$/;
// //BankAccountNumber should be minimum 11 and max 16 digits
// const BankAccountNumber = /^\d{11,16}$/;
// // Validation function for bankDetails object
// const validation = (bankDetails) => {
//   //bankname validation for minimum 3 characters
//   if (!nameRegex.test(bankDetails.BankName)) {
//     return "BankName should be minimum 3 characters!";
//   }
//   //branchName should be minimum 3 characters
//   if (!nameRegex.test(bankDetails.BranchName)) {
//     return "BranchName should be minimum 3 characters!";
//   }
//   //branchAddress should be minimum 3 characters
//   if (!nameRegex.test(bankDetails.BranchAddress)) {
//     return "BranchAddress should be minimum 3 characters!";
//   }
//   //customerNumber should be 11 characters
//   if (!CustomerNumberRegex.test(bankDetails.CustomerNumber)) {
//     return "CustomerNumber should be 11 characters!";
//   }
//   //bankDetails must be 11 digits
//   if (!BankAccountNumber.test(bankDetails.BankAccountNumber)) {
//     return "BankAccountNumber should be minimum 11 digits!";
//   }
//   return null; // Validation passed
// };
// // Function to create an employee
// const createBankDetialsInfo = async (event) => {
//   let response = { statusCode: 200 };
//   try {
//     // Parse the JSON body from the event
//     const body = JSON.parse(event.body);
//     const bankDetails = body.bankDetails;
//     console.log(bankDetails);
//     // Perform validation on bankDetails
//     const validationError = validation(bankDetails);
//     if (validationError) {
//       response.statusCode = 400;
//       response.body = JSON.stringify({
//         message: validationError,
//       });
//       throw new Error(validationError);
//     }
//     //Check for required fields in the body
//     const requiredBankDetails = [
//       "BankName",
//       "BranchName",
//       "BranchAddress",
//       "CustomerNumber",
//       "BankAccountNumber",
//       "IsSalaryAccount",
//       "IsActive",
//       "IsDeleted",
//     ];
//     //Iterate bankDetails to check mandatory fields
//     for (const field of requiredBankDetails) {
//       if (!body.bankDetails[field]) {
//         response.statusCode = 400;
//         throw new Error(`${field} is a mandatory field!`);
//       }
//     }
//     //empId should be given mandatory
//     if (!body.empId) {
//       response.statusCode = 400;
//       throw new Error("empId is a mandatory field!");
//     }
//     // Define parameters for inserting an item into DynamoDB
//     const params = {
//       TableName: process.env.DYNAMODB_TABLE_NAME,
//       //add the below line in params to validate post method to restrict duplicate posts
//       //ConditionExpression: "attribute_not_exists(empId)",
//       Item: marshall({
//         empId: body.empId,
//         bankDetails: {
//           BankName: bankDetails.BankName,
//           BranchName: bankDetails.BranchName,
//           BranchAddress: bankDetails.BranchAddress,
//           CustomerNumber: bankDetails.CustomerNumber,
//           BankAccountNumber: bankDetails.BankAccountNumber,
//           IsSalaryAccount: bankDetails.IsSalaryAccount,
//           IsActive: bankDetails.IsActive,
//           IsDeleted: bankDetails.IsDeleted,
//         },
//       }),
//     };
//     // Insert the item into DynamoDB
//     await client.send(new PutItemCommand(params));
//     response.body = JSON.stringify({
//       message: "Successfully created BankDetails!",
//     });
//   } catch (e) {
//     // To through the exception if anything failing while creating bankDetails
//     console.error(e);
//     if (e.name === "ConditionalCheckFailedException") {
//       response.statusCode = 400;
//       response.body = JSON.stringify({
//         message: "BankDetails Already Exists!",
//         errorMsg: e.message,
//       });
//     } else {
//       console.error(e);
//       response.body = JSON.stringify({
//         message: "Failed to update BankDetails.",
//         errorMsg: e.message,
//         errorStack: e.stack,
//       });
//     }
//   }
//   return response;
// };



// // Function to update an employee
// const updateBankDetialsInfo = async (event) => {
//   const response = { statusCode: 200 };
//   try {
//     // Parse the JSON body from the event
//     const body = JSON.parse(event.body);
//     const objKeys = Object.keys(body);
//     // Perform validation on bankDetails
//     const validationError = validation(body.bankDetails);
//     if (validationError) {
//       response.statusCode = 400;
//       response.body = JSON.stringify({
//         message: validationError,
//       });
//       throw new Error(validationError);
//     }
//     // Define parameters for updating an item in DynamoDB
//     const params = {
//       TableName: process.env.DYNAMODB_TABLE_NAME,
//       Key: marshall({ empId: event.pathParameters.empId }),
//       //add the below line in params to validate and restrict the put method (updates only if the attribute exists)
//       ConditionExpression: "attribute_exists(empId)",
//       UpdateExpression: `SET ${objKeys
//         .map((_, index) => `#key${index} = :value${index}`)
//         .join(", ")}`,
//       ExpressionAttributeNames: objKeys.reduce(
//         (acc, key, index) => ({
//           ...acc,
//           [`#key${index}`]: key,
//         }),
//         {}
//       ),
//       ExpressionAttributeValues: marshall(
//         objKeys.reduce(
//           (acc, key, index) => ({
//             ...acc,
//             [`:value${index}`]: body[key],
//           }),
//           {}
//         )
//       ),
//     };
//     // Update the item in DynamoDB
//     const updateResult = await client.send(new UpdateItemCommand(params));
//     response.body = JSON.stringify({
//       message: "Successfully updated BankDetails.",
//       updateResult,
//     });
//   } catch (e) {
//     console.error(e);
//     if (e.name === "ConditionalCheckFailedException") {
//       response.statusCode = 400;
//       response.body = JSON.stringify({
//         message: "BankDetails not found!",
//         errorMsg: e.message,
//       });
//     } else {
//       console.error(e);
//       response.body = JSON.stringify({
//         message: "Failed to update BankDetails.",
//         errorMsg: e.message,
//         errorStack: e.stack,
//       });
//     }
//   }
//   return response;
// };







//   // function delete EmployeeBankInfo to delete bank information of the employee
// const deleteBankDetialsInfo = async (event) => {
//     // defined const response and store the status code of 200
//     const response = { statusCode: 200 };
//     // try block will examine empId in DB and if found it will delete otherwise it will throw error
//     try {
//       const { empId } = event.pathParameters;
  
//       // Create an empty DynamoDB List attribute after delete perform
//       const emptyList = { L: [] };
  
//       // created const params and refered in program to proccess empId update
//       const params = {
//         // Table name
//         TableName: process.env.DYNAMODB_TABLE_NAME,
//         Key: marshall({ empId }),
//         UpdateExpression: 'SET bankInfoDetails = :emptyList',
//         ExpressionAttributeValues: {
//           ':emptyList': emptyList, //
//         },
//       };
  
//       // Use the update method with UpdateExpression to set bankInfoDetails to an empty list
//       const updateResult = await client.send(new UpdateItemCommand(params));
  
//       // convert raw data response from server to JSON string format
//       response.body = JSON.stringify({
//         message: `Successfully deleted empId bank Details.`,
//         updateResult,
//       });
//     } catch (e) {
//       console.error(e);
//       response.statusCode = 500;
//       // convert raw data response from server to JSON string format
//       response.body = JSON.stringify({
//         message: `Failed to delete empId bank Details.`,
//         errorMsg: e.message,
//         errorStack: e.stack,
//       });
//     }
//     // returns the response 200
//     return response;
//   };
  
//   const softDeleteBankDetialsInfo = async (event) => {
//     // set 200 response
//     const response = { statusCode: 200 };
//     try {
//       const { empId } = event.pathParameters;
//       // writing params
//       const params = {
//         // table name
//         TableName: process.env.DYNAMODB_TABLE_NAME,
//         // passing marshalled empId value
//         Key: marshall({ empId }),
//         // update expression for isActive property which present in bankInfoDetails
//         UpdateExpression: 'SET bankInfoDetails[0].isActive = :isActive',
//         ExpressionAttributeValues: {
//           // Set to true to update "isActive" to true
//           ':isActive': { BOOL: true },
//         },
//       };
  
//       // sending params to dynamoDb
//       const updateResult = await client.send(new UpdateItemCommand(params));
  
//       // response body values
//       response.body = JSON.stringify({
//         message: `Successfully soft deleted empId bank Details.`,
//         updateResult,
//       });
//     } catch (e) {
//       // error handling block for 500 error satus
//       console.error(e);
//       response.statusCode = 500;
//       response.body = JSON.stringify({
//         message: `Failed to soft delete empId bank Details.`,
//         errorMsg: e.message,
//         errorStack: e.stack,
//       });
//     }
//     // returns the response
//     return response;
//   };

  

  
//   module.exports = {
//     employeeBankDetailsAll,
//     getEmployeeBankDetialsInfo,
//     getAllEmployeesBankDetialsInfo,
//     createBankDetialsInfo,
//     updateBankDetialsInfo,
//     deleteBankDetialsInfo,
//     softDeleteBankDetialsInfo
//   }; // exporting the function
  