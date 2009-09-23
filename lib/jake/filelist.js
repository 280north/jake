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


// A FileList is essentially an array with a few helper methods defined to
// make file manipulation a bit easier.
//
// FileLists are lazy.  When given a list of glob patterns for possible files
// to be included in the file list, instead of searching the file structures
// to find the files, a FileList holds the pattern for latter use.
//
// This allows us to define a number of FileList to match any number of
// files, but only search out the actual files when then FileList itself is
// actually used.  The key is that the first time an element of the
// FileList/Array is requested, the pending patterns are resolved into a real
// list of file names.
//

function isRegExp(anObject)
{
    return typeof(anObject) === "function") && anObject.constructor.toString().match(/regexp/i) !== null
}

// Create a file list from the globbable patterns given.
//
// Example:
//   file_list = new FileList('lib/**/*.rb', 'test/test*.rb')
//
function FileList()
{
    this._pending_add = []
    this._pending = false
    this._excludePatterns = DEFAULT_IGNORE_PATTERNS.slice();
    this._excludeProcs = DEFAULT_IGNORE_PROCS.slice();
    this._excludeRe = nil
    this._items = []
    this.include.apply(this, arguments);
}
    # == Method Delegation
    #
    # The lazy evaluation magic of FileLists happens by implementing all the
    # array specific methods to call +resolve+ before delegating the heavy
    # lifting to an embedded array object (@items).
    #
    # In addition, there are two kinds of delegation calls.  The regular kind
    # delegates to the @items array and returns the result directly.  Well,
    # almost directly.  It checks if the returned value is the @items object
    # itself, and if so will return the FileList object instead.
    #
    # The second kind of delegation call is used in methods that normally
    # return a new Array object.  We want to capture the return value of these
    # methods and wrap them in a new FileList object.  We enumerate these
    # methods in the +SPECIAL_RETURN+ list below.

    # List of array methods (that are not in +Object+) that need to be
    # delegated.
    ARRAY_METHODS = (Array.instance_methods - Object.instance_methods).map { |n| n.to_s }

    # List of additional methods that must be delegated.
    MUST_DEFINE = %w[to_a inspect]

    # List of methods that should not be delegated here (we define special
    # versions of them explicitly below).
    MUST_NOT_DEFINE = %w[to_a to_ary partition *]

    # List of delegated methods that return new array values which need
    # wrapping.
    SPECIAL_RETURN = %w[
      map collect sort sort_by select find_all reject grep
      compact flatten uniq values_at
      + - & |
    ]

    DELEGATING_METHODS = (ARRAY_METHODS + MUST_DEFINE - MUST_NOT_DEFINE).collect{ |s| s.to_s }.sort.uniq

    # Now do the delegation.
    DELEGATING_METHODS.each_with_index do |sym, i|
      if SPECIAL_RETURN.include?(sym)
        ln = __LINE__+1
        class_eval %{
          def #{sym}(*args, &block)
            resolve
            result = @items.send(:#{sym}, *args, &block)
            FileList.new.import(result)
          end
        }, __FILE__, ln
      else
        ln = __LINE__+1
        class_eval %{
          def #{sym}(*args, &block)
            resolve
            result = @items.send(:#{sym}, *args, &block)
            result.object_id == @items.object_id ? self : result
          end
        }, __FILE__, ln
      end
    end



// Add file names defined by glob patterns to the file list.  If an array
// is given, add each element of the array.
//
// Example:
//   file_list.include("*.java", "*.cfg")
//   file_list.include %w( math.c lib.h *.o )
//
FileList.prototype.include = function()
{
    // TODO: check for pending
    Array.prototype.forEach.apply(arguments, function(/*Object*/ anArgument)
    {
        if (Array.isArray(anArgument))
            this.include.apply(this, anArgument);
        else if (typeof anArgument.toArray === "function")
            this.include.apply(this, anArgument.toArray());
        else
            this._pendingAdd.push(aFilename);
    }, this);

    this._pending = true;

    return this;
}

FileList.prototype.add = FileList.prototype.include;

// Register a list of file name patterns that should be excluded from the
// list.  Patterns may be regular expressions, glob patterns or regular
// strings.  In addition, a block given to exclude will remove entries that
// return true when given to the block.
//
// Note that glob patterns are expanded against the file system. If a file
// is explicitly added to a file list, but does not exist in the file
// system, then an glob pattern in the exclude list will not exclude the
// file.
//
// Examples:
//   FileList['a.c', 'b.c'].exclude("a.c") => ['b.c']
//   FileList['a.c', 'b.c'].exclude(/^a/)  => ['b.c']
//
// If "a.c" is a file, then ...
//   FileList['a.c', 'b.c'].exclude("a.*") => ['b.c']
//
// If "a.c" is not a file, then ...
//   FileList['a.c', 'b.c'].exclude("a.*") => ['a.c', 'b.c']
//
FileList.prototype.exclude = function()
{
    Array.prototype.forEach.apply(arguments, function(argument)
    {
        if (typeof argument === "function")
            this._exlcudeProcs.push(argument);
        else
            this._excludePatterns.push(argument);
    }, this);

    if (!this._pending)
        this.resolveExclude();

    return this;
}

FileList.prototype.clearExclude = function()
{
    this._excludePatterns = [];
    this._excludeProcs = [];
    
    if (!this._pending)
        this.calculateExcludeRegexp();

    return this;
}

FileList.prototype.toArray = function()
{
    this.resolve();
    return this._items;
}
/*
    # Lie about our class.
    def is_a?(klass)
      klass == Array || super(klass)
    end
    alias kind_of? is_a?

    # Redefine * to return either a string or a new file list.
    def *(other)
      result = @items * other
      case result
      when Array
        FileList.new.import(result)
      else
        result
      end
    end
*/

// Resolve all the pending adds now.
FileList.prototype.resolve = function()
{
    if (this._pending)
    {
        this._pending = false;

        this._pendingAdd.forEach(function(/*String*/ aFileName)
        {
            this.resolveAdd(aFilename);
        }, this);

        this._pendingAdd = [];
        
        this.resolveExclude();
    }

    return this;
}

FileList.prototype.calculateExcludeRegexp = function()
{
    var ignores = [];

    this._excludePatterns.forEach(function(aPattern)
    {
        if (isRegExp(aPattern))
            ignores.push(aPattern)
        /*
        else if ()
        
        case pat
        when Regexp
          ignores << pat
        when /[*?]/
          Dir[pat].each do |p| ignores << p end
        else
          ignores << Regexp.quote(pat)
        end*/
      end
      if ignores.empty?
        @exclude_re = /^$/
      else
        re_str = ignores.collect { |p| "(" + p.to_s + ")" }.join("|")
        @exclude_re = Regexp.new(re_str)
      end
    end
}

FileList.prototype.resolveAdd = function(/*String*/ aFilename)
{
    
      case fn
      when %r{[*?\[\{]}
        add_matching(fn)
      else
        self << fn
      end
    end
    private :resolve_add

    def resolve_exclude
      calculate_exclude_regexp
      reject! { |fn| exclude?(fn) }
      self
    end
    private :resolve_exclude
}

    # Return a new FileList with the results of running +sub+ against each
    # element of the oringal list.
    #
    # Example:
    #   FileList['a.c', 'b.c'].sub(/\.c$/, '.o')  => ['a.o', 'b.o']
    #
    def sub(pat, rep)
      inject(FileList.new) { |res, fn| res << fn.sub(pat,rep) }
    end

    # Return a new FileList with the results of running +gsub+ against each
    # element of the original list.
    #
    # Example:
    #   FileList['lib/test/file', 'x/y'].gsub(/\//, "\\")
    #      => ['lib\\test\\file', 'x\\y']
    #
    def gsub(pat, rep)
      inject(FileList.new) { |res, fn| res << fn.gsub(pat,rep) }
    end

    # Same as +sub+ except that the oringal file list is modified.
    def sub!(pat, rep)
      each_with_index { |fn, i| self[i] = fn.sub(pat,rep) }
      self
    end

    # Same as +gsub+ except that the original file list is modified.
    def gsub!(pat, rep)
      each_with_index { |fn, i| self[i] = fn.gsub(pat,rep) }
      self
    end

    # Apply the pathmap spec to each of the included file names, returning a
    # new file list with the modified paths.  (See String#pathmap for
    # details.)
    def pathmap(spec=nil)
      collect { |fn| fn.pathmap(spec) }
    end

    # Return a new file list with <tt>String#ext</tt> method applied
    # to each member of the array.
    #
    # This method is a shortcut for:
    #
    #    array.collect { |item| item.ext(newext) }
    #
    # +ext+ is a user added method for the Array class.
    def ext(newext='')
      collect { |fn| fn.ext(newext) }
    end


    # Grep each of the files in the filelist using the given pattern. If a
    # block is given, call the block on each matching line, passing the file
    # name, line number, and the matching line of text.  If no block is given,
    # a standard emac style file:linenumber:line message will be printed to
    # standard out.
    def egrep(pattern)
      each do |fn|
        open(fn) do |inf|
          count = 0
          inf.each do |line|
            count += 1
            if pattern.match(line)
              if block_given?
                yield fn, count, line
              else
                puts "#{fn}:#{count}:#{line}"
              end
            end
          end
        end
      end
    end

    # Return a new file list that only contains file names from the current
    # file list that exist on the file system.
    def existing
      select { |fn| File.exist?(fn) }
    end

    # Modify the current file list so that it contains only file name that
    # exist on the file system.
    def existing!
      resolve
      @items = @items.select { |fn| File.exist?(fn) }
      self
    end

    # FileList version of partition.  Needed because the nested arrays should
    # be FileLists in this version.
    def partition(&block)       # :nodoc:
      resolve
      result = @items.partition(&block)
      [
        FileList.new.import(result[0]),
        FileList.new.import(result[1]),
      ]
    end

    # Convert a FileList to a string by joining all elements with a space.
    def to_s
      resolve
      self.join(' ')
    end

    # Add matching glob patterns.
    def add_matching(pattern)
      Dir[pattern].each do |fn|
        self << fn unless exclude?(fn)
      end
    end
    private :add_matching

    # Should the given file name be excluded?
    def exclude?(fn)
      calculate_exclude_regexp unless @exclude_re
      fn =~ @exclude_re || @exclude_procs.any? { |p| p.call(fn) }
    end

var DEFAULT_IGNORE_PATTERNS = 
    [
      /(^|[\/\\])CVS([\/\\]|$)/,
      /(^|[\/\\])\.svn([\/\\]|$)/,
      /\.bak$/,
      /~$/
    ];

    DEFAULT_IGNORE_PROCS =
    [
      proc { |fn| fn =~ /(^|[\/\\])core$/ && ! File.directory?(fn) }
    ]
#    @exclude_patterns = DEFAULT_IGNORE_PATTERNS.dup

FileList.prototype.import = function(/*Array*/ anArray)
{
    this._items = array
    return this;
}
