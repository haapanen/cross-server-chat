// Type definitions for prompt v0.2.14
// Project: https://github.com/flatiron/prompt
// Definitions by: Jussi Haapanen https://github.com/haapanen
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

///<reference path="../node/node.d.ts"/>

// Module cannot be named prompt as it will conflict with lib.es6.d.ts prompt
declare module __prompt {
    export interface SchemaProperty {
        /**
         * Name of the property. Only used if an array of properties are passed to
         * prompt.get.
         */
        name?: string;
        /**
         * Prompt displayed to the user. If not supplied name will be used.
         */
        description?: string;
        /**
         * The type of the input to expect.
         *
         * Type `boolean` accepts case insensitive values `true`, `t`, `false` and `f`.
         *
         * Type `array` has some special cases:
         * - `description` will not work in the schema if type is `array`.
         * - maxItems takes precedence over minItems.
         * - Arrays that do not have maxItems defined will require users to SIGINT (^C)
         * before the array is ended.
         * - If SIGINT (^C) is triggered before minItems is met, a validation error will appear.
         * This will require users to SIGEOF (^D) to end the input.
         */
        type?: string;
        /**
         * Property must match this pattern.
         */
        pattern?: RegExp;
        /**
         * What will be displayed if pattern doesn't match.
         */
        message?: string;
        /**
         * If true, characters entered will either not be output to the console
         * or will be outputed using the `replace` string
         */
        hidden?: boolean;
        /**
         * If `hidden` is set it will replace each hidden character with the specific string.
         */
        replace?: string;
        /**
         * Default value to use if no value is entered.
         */
        default?: string;
        /**
         * If true, value entered must be non-empty
         */
        required?: boolean;
        /**
         * Runs before the node-prompt callbacks. It modifies user's input
         * @param value
         */
        before?: (value: string) => void;
        /**
         * Whether this value should be asked. Return true if this should be asked
         * Example:
         * properties: {
         proxy: {
           description: 'Proxy url',
         },
         proxyCredentials: {
             description: 'Proxy credentials',
             ask: function() {
               // only ask for proxy credentials if a proxy was set
               return prompt.history('proxy').value > 0;
             }
           }
         }
         */
        ask?: () => boolean;
        /**
         * Custom validation function for the value
         * @param value
         */
        conform?: (value: any) => boolean;
    }

    export interface SchemaPropertiesHash {
        /**
         * Properties that the prompt will ask user
         */
        [property: string]: SchemaProperty;
    }

    export interface PromptOptions {
        stdin?: NodeJS.ReadableStream;
        stdout?: NodeJS.WritableStream;
        /**
         * How many prompt property / answer pairs to be remembered
         */
        memory?: number;
        /**
         * ALlow empty responses globally
         */
        allowEmpty?: boolean;
        /**
         * Custom prompt message
         * The basic structure of a prompt is:
         *  prompt.message + prompt.delimiter + property.message + prompt.delimiter;
         */
        message?: string;
        /**
         * Custom prompt delimiter
         */
        delimiter?: string;
        /**
         * Use colors
         */
        colors?: boolean;
    }

    export interface Schema {
        properties: SchemaPropertiesHash;
    }

    /**
     * Starts the prompt by listening to the appropriate events on `options.stdin`
     * and `options.stdout`. If no streams are supplied, then `process.stdin` and
     * `process.stdout` are used, respectively.
     * @param options
     */
    export function start(options?: PromptOptions);

    /**
     * Gets input from the user via stdin for the specified messages
     * @param schema Set of variables to get input for.
     * @param callback Continuation to pass control to when complete.
     */
    export function get(properties: Schema | Array<string> | Array<SchemaProperty>, callback: (error: string, result:any) => void);

    /**
     * Prompts the user for values each of the `properties` if `obj` does not already
     * have a value for the property. Responds with the modified object.
     * @param object Object to add properties to
     * @param propertyNames List of properties to get values for
     * @param callback Continuation to pass control to when complete.
     */
    export function addProperties(object: any, propertyNames: Array<string>, callback: (error: string) => void);

    /**
     * Returns the `property:value` pair from within the prompts
     * `history` array.
     * @param name Index or property name to find.
     */
    export function history(search: number | string): any;
}

declare module "prompt" {
    export = __prompt;
}