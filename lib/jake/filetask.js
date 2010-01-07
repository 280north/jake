#!/usr/bin/env narwhal

// Copyright 2009 280 North, Inc. (francisco@280north.com)
// Copyright 2003, 2004, 2005, 2006, 2007, 2008, 2009 by Jim Weirich (jim.weirich@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//

var FILE = require("file"),
    Jake = require("jake"),
    Task = require("jake/task").Task;

// A FileTask is a task that includes time based dependencies.  If any of a
// FileTask's prerequisites have a timestamp that is later than the file
// represented by this task, then the file must be rebuilt (using the
// supplied actions).
var FileTask = function()
{
    Task.apply(this, arguments);
}

FileTask.__proto__ = Task;
FileTask.prototype.__proto__ = Task.prototype;

// Is this file task needed?  Yes if it doesn't exist, or if its time stamp
// is out of date.
FileTask.prototype.isNeeded = function()
{
    return !FILE.exists(this.name()) || this.outOfDate(this.timestamp());
}

// Time stamp for file task.
FileTask.prototype.timestamp = function()
{
    if (FILE.exists(this.name()))
        return FILE.mtime(this.name());

    return Jake.EARLY;
}

// Are there any prerequisites with a later time than the given time stamp?
FileTask.prototype.outOfDate = function(aTimestamp)
{
    var application = this.application();

    return this._prerequisites.some(function(aTaskName)
    {
        return application.lookupTask(aTaskName).timestamp() > aTimestamp;
    }, this);
}

// Apply the scope to the task name according to the rules for this kind
// of task.  File based tasks ignore the scope when creating the name.
FileTask.scopeName = function(/*Array<String>*/ aScope, /*String*/ aTaskName)
{
    return aTaskName;
}

// EXPORTS
exports.FileTask = FileTask;
