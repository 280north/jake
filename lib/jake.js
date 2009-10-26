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
    SYSTEM = require("system"),

    Task = require("jake/task").Task,
    FileTask = require("jake/filetask").FileTask,
    FileCreationTask = require("jake/filecreationtask").FileCreationTask,
    TaskManager = require("jake/taskmanager").TaskManager,
    Application = require("jake/application").Application;

// FIXME: MAJOR hack to get globs working.
FILE.glob = function(aPattern)
{
    var OS = require("os");

    OS.system("echo \"puts Dir.glob('" + aPattern + "')\" | ruby > /tmp/glob_fixme.txt");

    return FILE.read("/tmp/glob_fixme.txt", {charsert:"UTF-8"}).split('\n').slice(0, -1);
}

// Exports
exports.Task = Task;
exports.FileTask = FileTask;
exports.FileCreationTask = FileCreationTask;
exports.TaskManager = TaskManager;
exports.Application = Application;

var application = null;

exports.application = function()
{
    if (!application)
        application = new Application();

    return application;
}

exports.setApplication = function(/*Application*/ anApplication)
{
    application = anApplication;
}

exports.EARLY = new Date(-10000,1,1,0,0,0,0).getTime();

exports.task = function()
{
    return Task.defineTask.apply(Task, arguments);
}

exports.file = function()
{
    return FileTask.defineTask.apply(FileTask, arguments);
}

exports.fileCreate = function()
{
    return FileCreationTask.defineTask.apply(FileCreationTask, arguments);
}

exports.directory = function(aDirectory)
{
    var oldLength = null;

    while (aDirectory !== "." && aDirectory.length !== oldLength)
    {
        exports.fileCreate(aDirectory, function(aTask)
        {
            var taskName = aTask.name();

            if (!FILE.exists(taskName))
                FILE.mkdirs(taskName);
        });

        oldLength = aDirectory.length;
        aDirectory = FILE.dirname(aDirectory);
    }
}

exports.filedir = function()
{
    var fileTask = FileTask.defineTask.apply(FileTask, arguments),
        fileDirectory = FILE.dirname(fileTask.name());

    exports.directory (fileDirectory);
    exports.file (fileTask.name(), fileDirectory);
}

exports.FileList = require("jake/filelist").FileList;
/*
    # Return the original directory where the Rake application was started.
    def original_dir
      application.original_dir
    end
*/
