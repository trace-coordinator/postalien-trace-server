# Lightweight programmable query CLI

### Usage

```typescript
import { postwowan } from "postwoman";
postwoman(request: Requests);
```

### `Requests` object

Each sub-field act as a sub-level until you define the `Request` object.

```typescript
Parent: {
    Child: {
        "Request 1": {
            request: () => fetch(..),
        },
        "Request 2": {
            body: {
                name: `name`,
                url: `{{variable}}`,
            },
            prequest: function () {
                return Promise.resolve(doSomething(this.body));
            },
            request: function (prequest_result?) {
                return fetch(this.body);
            },
            postquest: (request_result?) => {
                setVar(request_result.x);
                return Promise.resolve();
            }
        },
    },
}
```

Will give you this structure:

```
Parent
=== Child
   Request 1
   Request 2
```

### `Request` object

has 4 fields:

-   quiet?: _boolean_ print output of request to console.
-   body?: _object literal_ the optional body for the request, so you can define the body of the request here instead of putting it directly in the `request` function, this helps if someone want to verify the body structure instead without needing to look into the request function source code. You can also use variable here using the syntax `{{variable}}`
-   prequest?: executed before request, return Promise, result of Promise will be passed to `request`
-   request: the request function, return Promise, result of Promise will be passed to `postquest`
-   postquest?: executed after request, return Promise, result of Promise will be ignored.

The result of these 3 functions are chained one after another: `prequest` -> `request` -> `postquest`. Also, if you want to use the `body` in one of these 3 functions, make sure you use the `function()` syntax and not the arrow function, as it doesn't bind `this`. Nothing stop you from defining another data field than `body` then use it, but only `body` field support `{{variable}}`. To set or get variables in functions, use `setVar` and `getVar`, or set it manually in db.json
