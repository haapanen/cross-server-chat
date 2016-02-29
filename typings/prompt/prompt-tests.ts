///<reference path="prompt.d.ts"/>

import * as prompt from "prompt";

//
// Start the prompt
//
prompt.start();

//
// Get two properties from the user: username and email
//
prompt.get(['username', 'email'], function (err, result) {
    //
    // Log the results.
    //
    console.log('Command-line input received:');
    console.log('  username: ' + result.username);
    console.log('  email: ' + result.email);

    testSchema();
});

/**
 * Test prompt get with a simple schema definition
 */
function testSchema() {
    var schema:prompt.Schema = {
        properties: {
            name: {
                pattern: /^[a-zA-Z\s\-]+$/,
                message: 'Name must be only letters, spaces, or dashes',
                required: true
            },
            password: {
                hidden: true
            }
        }
    };

    //
    // Get two properties from the user: email, password
    //
    prompt.get(schema, function (err, result) {
        //
        // Log the results.
        //
        console.log('Command-line input received:');
        console.log('  name: ' + result.name);
        console.log('  password: ' + result.password);

        testAlternateValidationAPI();
    });
}

/**
 * Test alternative way of validate the values
 */
function testAlternateValidationAPI() {
    //
    // Get two properties from the user: username and password
    //
    prompt.get([{
        name: 'username',
        required: true
    }, {
        name: 'password',
        hidden: true,
        conform: function (value) {
            return true;
        }
    }], function (err, result) {
        //
        // Log the results.
        //
        console.log('Command-line input received:');
        console.log('  username: ' + result.username);
        console.log('  password: ' + result.password);

        testPropertyAdding();
    });
}

/**
 * Test addProperties
 */
function testPropertyAdding() {
    var obj = {
        password: 'lamepassword',
        mindset: 'NY'
    }

    //
    // Log the initial object.
    //
    console.log('Initial object to be extended:');
    console.dir(obj);

    //
    // Add two properties to the empty object: username and email
    //
    prompt.addProperties(obj, ['username', 'email'], function (err) {
        //
        // Log the results.
        //
        console.log('Updated object received:');
        console.dir(obj);
    });
}

