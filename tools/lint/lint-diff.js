#!/usr/bin/env node
/* eslint-env node */

var diff = require('diff');

var process_lintfile = function(filename) {

    var i, file;
    var fs = require('fs');
    var report = JSON.parse(fs.readFileSync(filename));
    var message;
    var output = {
        report: {
            messages: []
        },
        messages: []
    };

    if (report.files && report.files) {
        // phpcs mode
        for (file in report.files) {
            if (report.files.hasOwnProperty(file)) {
                output.report.file = file;
                for (i = 0; i < report.files[file].messages.length; i++) {
                    message = report.files[file].messages[i];
                    output.report.messages.push({
                        line: message.line,
                        column: message.column,
                        type: message.type,
                        message: message.message
                    });
                    output.messages.push(message.type + message.severity + message.source + message.message);
                }
            }
            return output;
        }
    } else {
        // eslint mode
        output.report.file = report[0].filePath;
        for (i = 0; i < report[0].messages.length; i++) {
            message = report[0].messages[i];
            output.report.messages.push({
                line: message.line,
                column: message.column,
                type: message.severity > 1 ? "ERROR" : "WARNING",
                message: message.message + "\t" + message.ruleId
            });
            output.messages.push(message.ruleId + message.severity + message.source + message.message);
        }
        return output;
    }

    return null;
};

var format_message = function(message) {
    return message.line + ":" + message.column + "\t" + message.type + "\t" + message.message + "\n";
};

var format_counts = function(counts) {
    var total = counts.error + counts.warning;

    var english_plural = function(val, word) {
        if (val > 1) {
            return val + " " + word + "s";
        }
        return val + " " + word;
    };

    return english_plural(total, "problem") +
        " (" + english_plural(counts.error, "error") + ")" +
        " (" + english_plural(counts.warning, "warning") + ")";
};

var report1 = process_lintfile(process.argv[2]);
var report2 = process_lintfile(process.argv[3]);

var differences = diff.diffArrays(report1.messages, report2.messages);

var outstr = report2.report.file + "\n";
var counts = {error: 0, warning: 0};

var exitcode = 0;
var i, j = 0;
for (i = 0; i < differences.length; i++) {
    if (differences[i].added) {
        exitcode = 1;
        for (var k = 0; k < differences[i].count; k++) {
            outstr += format_message(report2.report.messages[j]);
            if (report2.report.messages[j].type == "ERROR") {
                counts.error += 1;
            } else {
                counts.warning += 1;
            }
            j++;
        }
    } else if (differences[i].removed) {
        // do nothing
    } else {
        j += differences[i].count;
    }
}

if (exitcode) {
    process.stdout.write(outstr);
    process.stdout.write("\n" + format_counts(counts) + "\n");
}
process.exit(exitcode);
