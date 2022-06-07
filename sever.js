/**
 * Nhat Trang
 * June 7th 2022
 */

// express to handle request
const express = require("express");
const app = express();

// parse json in the body of request
app.use(express.json());

// allow for connection between different origin
const cors = require("cors");
const corsOptions ={
   origin:'*', 
   credentials:true,            
   optionSuccessStatus:200,
}

app.use(cors(corsOptions))

// privates
require("dotenv").config();

// google sheet
const { GoogleSpreadsheet } = require('google-spreadsheet');

// the google sheet
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
// link to sheet https://docs.google.com/spreadsheets/d/1BjsH5S-8vNwJxlM5CCQiTkvXsahmkDqc_RfRlgQWM9g/edit?usp=sharing


/**
 * @api {get} 
 * @apiName GetPairedValue
 * 
 * @apiSuccess (200: Success) {String} result: int, data: {}
 * 
 *  * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      result : 200
 *       "data": {
 *              "key1": "value1",
 *              "key2": "value2",
 *              "key3": "value3",
 *              "key4": "value4"
 *          }
 *     }
 * 
 * @apiError (500: Problem connecting to spreadsheet) {String} description: "Problem connecting to spreadsheet"
 * 
 * @apiError (500: Problem getting data) {String} description: "Problem getting data"
 * 
 */ 
app.get("/", (request, respond, next) => {
    connectToSpreadSheet()
        .then((sheet) => {
            request.body.GoogleSheet = sheet;
            next();
        })
        .catch(err => {
            respond.status(500).send({
                result: 500,
                description: "Problem connecting to spreadsheet"
            })
        });
}, (request, respond) => {
    request.body.GoogleSheet.getRows()
        .then(rows => {
            let data = {};
            for (let i = 0; i < rows.length; i++) {
                data[rows[i].Key] = rows[i].Value;
            }
            respond.status(200).send({
                result: 200,
                data
            });
        })
        .catch(err => {
            respond.status(500).send({
                result: 500,
                description: "Problem getting data"
            })
        })
});

/**
 * @api {post} 
 * @apiName AddUpdateValue
 * 
 * @apiSuccess (200: Success) {String} result: int, description: String
 * 
 *  * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          result: 200,
 *          description: "Value has been updated"
 *      }
 * * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          result: 201,
 *          description: "Paired Value added"
 *      }
 * 
 * @apiError (400: Invalid input) {String} description: "Invalid input"
 * 
 * @apiError (500: Problem connecting to spreadsheet) {String} description: "Problem connecting to spreadsheet"
 * 
 * @apiError (500: Problem updating existing key) {String} description: "Problem updating existing key"
 * 
 * @apiError (500: Problem adding new key) {String} description: "Problem adding new key"
 * 
 */ 
app.post("/data", (request, respond, next) => {
    request.body.keys = Object.keys(request.body);
    request.body.values = Object.values(request.body);

    //check to see if new input pair is valid          
    if (request.body.keys.length === 1 && request.body.values.length === 2 && 
        !isEmpty(request.body.values[0]) && !isEmpty(request.body.keys[0])) {
        connectToSpreadSheet()
            .then(sheet => {
                request.body.GoogleSheet = sheet;
                next();
            })
            .catch(err => {
                respond.status(500).send({
                    result: 500,
                    description: "Problem connecting to spreadsheet"
                });
            })
    } else {
        respond.status(400).send({
            result: 400,
            description: "Invalid input"
        });
    }
}, (request, respond, next) => {
    request.body.GoogleSheet.getRows()
        .then( async (rows) => {
            let dulicate = false;
            // check for 1st dulicate and update 
            // (assuming there should never be more than 1 dulicate)
            for (let i = 0; i < rows.length; i++) { 
                if (request.body.keys[0] === rows[i].Key) {
                    dulicate = true;
                    rows[i].Value = request.body.values[0];
                    await rows[i].save();
                    break;
                }
            }
            if (!dulicate) { 
                next();
            } else {
                respond.status(200).send({
                    result: 200,
                    description: "Value has been updated"
                });
            }
        })
        .catch(err => {
            respond.status(500).send({
                result: 500,
                description: "Problem updating existing key"
            });
        });
}, (request, respond) => {
    request.body.GoogleSheet.addRow({
        Key: request.body.keys[0], 
        Value: request.body.values[0]
    })
    .then(() => {
        respond.status(201).send({
            result: 201,
            description: "Paired Value added"
        });
    })
    .catch(err => {
        respond.status(500).send({
            result: 500,
            description: "Problem adding new key"
        });
    }); 
});

/**
 * @api {delete} 
 * @apiName DeleteValue
 * 
 * @apiSuccess (200: Success) {String} result: int, description: String
 * 
 *  * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *          result: 200,
 *          description: "Paired value deleted"
 *      }
 * 
 * @apiError (400: can't find key) {String} description: "can't find key""
 * 
 * @apiError (500: Problem connecting to spreadsheet) {String} description: "Problem connecting to spreadsheet"
 * 
 * @apiError (500: Problem deleting key-value pair) {String} description: "PProblem deleting key-value pair"
 * 
 */ 
app.delete("/data/:key", (request, respond, next) => {
    connectToSpreadSheet()
        .then(sheet => {
        request.body.GoogleSheet = sheet;
        next()
        })
        .catch(err => {
            respond.status(500).send({
                result: 500,
                description: "Problem connecting to spreadsheet"
            })
        })

}, (request, respond) => {
    request.body.GoogleSheet.getRows()
        .then(rows => {
            let hasKey = false;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].Key === request.params.key) {
                    hasKey = true;
                    rows[i].delete();
                    respond.status(200).send({
                        result: 200,
                        description: "Paired value deleted"
                    })
                }
            }
            if (!hasKey) {
                respond.status(400).send({
                    result: 500,
                    description: "can't find key"
                })
            }

        })
        .catch (err => {
            respond.status(500).send({
                result: 500,
                description: "Problem deleting key-value pair"
            })
        })
})

async function connectToSpreadSheet() {
    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SERVICE_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_KEY.replace(/\\n/g, '\n')

    });
    // loads document properties and worksheets
    await doc.loadInfo(); 
    const sheet = doc.sheetsByIndex[0];
    return sheet;
}

function isEmpty(string) {
    if (string.length === 0) {
        return true;
    }else {
        return false;
    }
}

app.listen(process.env.PORT || 3000, () => {
    console.log("listening on: " + (process.env.PORT ||3000));
})