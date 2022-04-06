/**
 * Created by hadrien1 on 08/02/17.
 */

import http from 'http'

const respond = function (res, content, status) {
    if ('undefined' == typeof status) { // only one parameter found
        if ('number' == typeof content || !isNaN(parseInt(content))) { // usage "respond(status)"
            status = parseInt(content);
            content = undefined;
        } else { // usage "respond(content)"
            status = 200;
        }
    }
    if (status != 200) { // error
        content = {
            "code":    status,
            "status":  http.STATUS_CODES[status],
            "message": content && content.toString() || null
        };
    }
    if ('object' != typeof content) { // wrap content if necessary
        content = {"result":content};
    }
    // respond with JSON data
    res.status(status).send(JSON.stringify(content)+"\n")
}

export default respond