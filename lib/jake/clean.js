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


// The 'jake/clean' file defines two file lists (CLEAN and CLOBBER) and
// two jake tasks ("clean" and "clobber").
//
// ["clean"] Clean up the project by deleting scratch files and backup
//           files.  Add files to the CLEAN file list to have the :clean
//           target handle them.
//
// ["clobber"] Clobber all generated and non-source files in a project.
//             The task depends on :clean, so all the clean files will
//             be deleted as well as files in the CLOBBER file list.
//             The intent of this task is to return a project to its
//             pristine, just unpacked state.

var FILE = require("file"),
    Jake = require("jake"),
    FileList = require("jake/filelist").FileList;


var CLEAN = new FileList("**/*~", "**/*.bak", "**/core");

CLEAN.clearExclude().exclude(function(aFilename)
{
    return FILE.basename(aFilename) === "core" && FILE.isDirectory(aFilename);
});

//  desc "Remove any temporary products."
Jake.task("clean", function()
{
    CLEAN.forEach(function(aFilename)
    {
        try
        {
            FILE.rmtree(aFilename);
        }
        catch(anException)
        {
        }
    });
});

var CLOBBER = new Jake.FileList();

//  desc "Remove any generated file."
Jake.task("clobber", ["clean"], function()
{
    CLOBBER.forEach(function(aFilename)
    {
        try
        {
            FILE.rmtree(aFilename);
        }
        catch(anException)
        {
        }
    });
});

exports.CLEAN = CLEAN;
exports.CLOBBER = CLOBBER;
