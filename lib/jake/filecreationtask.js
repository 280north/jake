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
    FileTask = require("jake/filetask").FileTask;

// #########################################################################
// A FileCreationTask is a file task that when used as a dependency will be
// needed if and only if the file has not been created.  Once created, it is
// not re-triggered if any of its dependencies are newer, nor does trigger
// any rebuilds of tasks that depend on it whenever it is updated.
//
var FileCreationTask = function()
{
    FileTask.apply(this, arguments);
}

FileCreationTask.__proto__ = FileTask;
FileCreationTask.prototype.__proto__ = FileTask.prototype;

//print("IT IS " + FileTask.defineTask + " " + FileCreationTask.defineTask);
// Is this file task needed?  Yes if it doesn't exist.
FileCreationTask.prototype.isNeeded = function()
{
    return !FILE.exists(this.name());
}

// Time stamp for file creation task.  This time stamp is earlier
// than any other time stamp.
FileCreationTask.prototype.timestamp = function()
{
    return Jake.EARLY;
}

// Exports
exports.FileCreationTask = FileCreationTask;
