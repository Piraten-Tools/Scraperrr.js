var Tarantula = require('tarantula'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    sanitizer = require("sanitizer"),
    cheerio = require("cheerio"),
    schemaEnv = require('schema')(),
    json2csv = require('json2csv').parse;;

exports.init = function(config) {

    var _events = {
        motionCreated: function(motionsFinishedCount, motion) {},
        done: function(motionsFinishedCount, outputFilename) {},
        error: function(message) {},
        warning: function(message) {}
    };

    // validate config

    if (!config) {
        var message = 'Configuration is empty.';
        _events.error(message);
        console.error(message);
        return;
    }

    if (!config.start_page && !config.start_pages) {
        var message = 'No start_page or start_pages defined in configuration.';
        _events.error(message);
        console.error(message);
        return;
    }

    if (!config.contexts || config.contexts.length < 1) {
        var message = 'No contexts defined in configuration.';
        _events.error(message);
        console.error(message);
        return;
    }

    config.politeness = config.politeness || 200;
    config.debug = config.debug || false;
    config.orderby = config.orderby || 'id';
    config.outputDirectory = config.outputDirectory || 'out/'+config.event+'/';
    config.format = config.format || 'json';
    config.separate = config.separate || false;
    config.userAgent = config.userAgent || 'Scraperrr.js';

    return {
        on: function(name, fn) {
            _events[name] = fn;
            return this;
        },

        brain: {

            config: config,
            outputFile: config.outputFile,
            outputFilename: config.outputFile,
            motions: [],
            motionsIDs: [],
            output: undefined,
            headers: {},

            politeness: config.politeness,

            parseMotion: function(config, motion, body, $) {
                // iterate over all fields in config.data
                for (var i in config.data) {
                    // get the meta data of the field
                    var field = config.data[i];

                    if(field.regex) {
                        // if it is a regex, perform it on the body
                        match = body.match(new RegExp(field.regex, 'ms'));
                        // and save in the target object under the given name
                        group = field.group ? field.group : 1
                        motion[field.name] = match ? match[group] : undefined;
                        if(this.config.stripHTML) {
                            motion[field.name] = this.stripHTML(motion[field.name]);
                        }
                    } else if (field.selector) {
                        // if it is a selector, perform it on the DOM
                        motion[field.name] = $(field.selector).html();
                        if(motion[field.name]) {
                            motion[field.name] = motion[field.name].trim()
                        }
                        if(this.config.stripHTML) {
                            motion[field.name] = this.stripHTML(motion[field.name]);
                        }
                    } else if (field.matchEnums && field.matchEnums.length > 0) {
                        for(var m in field.matchEnums) {
                            var option = field.matchEnums[m];
                            match = body.match(new RegExp(option.regex, 'm'));
                            // matches the first, then leaves loop
                            if(match) {
                                motion[field.name] = option.value;
                                break;
                            }
                        }
                    }

                    if(field.value) {
                        motion[field.name] = field.value;
                    }
                    if(field.required && !motion[field.name]) {
                        // add onwarning
                        _events.warning('Warning: Data field "'+ field.name + '" may not be undefined or empty in '+motion.url+'!');
                        console.error('Warning: Data field "'+ field.name + '" may not be undefined or empty in '+motion.url+'!');
                        if(this.config.debug) {
                            console.log("Regular expression: " + field.regex);
                            console.log("Error string:\n" + body);
                        }
                    }
                }
            },

            stripHTML: function(html) {
                var clean = sanitizer.sanitize(html, function (str) {
                    return str;
                });
                if(clean) {
                    // Remove all remaining HTML tags.
                    clean = clean.replace(/<(?:.|\n)*?>/gm, "");

                    // RegEx to remove needless newlines and whitespace.
                    // See: http://stackoverflow.com/questions/816085/removing-redundant-line-breaks-with-regular-expressions
                    clean = clean.replace(/(?:(?:\r\n|\r|\n)\s*){2,}/ig, "  \n");

                    // Return the final string, minus any leading/trailing whitespace.
                    return clean.trim();
                } else {
                    return '';
                }
            },

            createMotion: function (config, body, uri, $) {
                var motion = {},
                    idRegEx = new RegExp(config.regexIdUrl, "");

                motion.url = uri;

                match = uri.match(idRegEx);
                motion.id = match ? match[1] : undefined;

                this.parseMotion(config, motion, body, $);

                // check if we already know this motion id
                // if so, we do not need to proceed and skip
                if(motion.id && this.motionsIDs.indexOf(motion.id) == -1 && motion.id != '&nbsp;') {

                    this.motions.push(motion);
                    this.motionsIDs.push(motion.id);
                    _events.motionCreated(this.motions.length, motion);
                    if(this.debug) {
                        console.log(motion);
                    } else {
                        process.stdout.write(".");
                    }
                }
            },

            shouldVisit: function(uri) {
                // some portals have all pages on one page.
                // In this case, we do not need to visit any detail pages of a specific context
                var context = this.detectContext(config, uri);
                if(context && context.detail) {
                    var detailUrl = new RegExp(context.detailUrl, '');
                    return uri.match(detailUrl);
                }
                return false;
            },

            detectContext: function(config, uri) {
                for (var i in config.contexts) {

                    // first we detect the context
                    var context = config.contexts[i],
                        regexContext = new RegExp(context.regexContext, '');

                    if(!context.skip) {
                        // based on the given regular expression
                        // we try to detect to which context the url belongs
                        if(uri.match(regexContext)) {
                            return context;
                        }
                    }
                }
                return undefined;
            },

            visit : function(request, response, body, $) {
                // the website we visit can be of any context
                var context = this.detectContext(config, request.uri);

                if(!context) {
                    _events.error("No context associated for URL: "+ request.uri);
                    console.error('No context found for ' + request.uri);
                    return;
                }

                if(request.uri != context.start_page) {

                    this.createMotion(context, body, request.uri, $);

                } else {

                    // all motions are on the same page
                    // split into blocks
                    if(context.regexMotion) {
                        var motionBlocks = body.split(new RegExp(context.regexMotion, ''));

                        // parse each block
                        for (var i = 0; i < motionBlocks.length; i++) {
                            $ = cheerio.load(motionBlocks[i]);
                            this.createMotion(context, motionBlocks[i], request.uri, $);
                        }
                    }

                }
            },

            onComplete: function() {
                if(!config.debug) {
                    process.stdout.write("\n");
                }
                console.log('Done, found '+ this.motions.length + ' motions for #'+config.event);

                // sort motions
                this.motions.sort(this.sortBy);

                var timestamp = Math.floor(Date.now() / 1000);
                if(config.separate) {
                    var scope = this;
                    var types = ["Grundsatzprogramm","Positionspapier","Wahlprogramm","Satzungsänderungsantrag","Sonstiger Antrag"];
                    types.forEach(function(type) {
                        // filter motions
                        var filteredMotions = scope.motions.filter(function (motion) {
                            return motion.type == type;
                        });
                        // export as json
                        scope.data = filteredMotions;
                        scope.outputFilename = config.event + '-' + timestamp + '-' + type + '.json';
                        scope.outputFile = config.outputDirectory + scope.outputFilename;
                        if(scope.outputFile) {
                            var parts = scope.splitByLastDot(scope.outputFile);
                            outputFile = parts[0] + '-' + type + '.' + parts[1];
                        }
                        scope.exportData(outputFile);
                    });
                } else {
                    // export as json
                    this.data = this.motions;
                    this.outputFilename = config.event+'-'+timestamp+'.json';
                    this.outputFile = this.outputFile || config.outputDirectory+this.outputFilename;
                    this.exportData(this.outputFile);
                }
            },

            splitByLastDot: function(text) {
                var index = text.lastIndexOf('.');
                return [text.slice(0, index), text.slice(index + 1)]
            },

            sortBy: function(compA, compB) {
                return (compA[config.orderby] < compB[config.orderby]) ? -1 : (compA[config.orderby] > compB[config.orderby]) ? 1 : 0;
            },

            exportData: function(outputFile) {
                if(this.data.length > 0) {
                    this.output = JSON.stringify(this.data, null, 2);
                    if(config.format == "csv") {
                        var fields = Object.keys(this.data[0]);
                        var opts = { fields: fields };
                        this.output = json2csv(this.data, opts);
                        outputFile = outputFile.replace(".json", ".csv");
                    }
                    this.writeData(outputFile);
                }
            },

            writeData: function(outputFile) {
                var outputPath = outputFile.slice(0, outputFile.lastIndexOf('/')),
                    scope = this;

                // create path, if it does not exist
                mkdirp(outputPath, function(err) {

                    if(err) {
                        console.error(err);
                    } else {
                        // write into file
                        fs.writeFile(outputFile, scope.output, function(err) {
                            if(err) {
                                console.log("some error")
                                _event.error(err);
                            } else {
                                console.log('The file was saved in '+ outputFile);
                            }
                        });
                    }

                });

            },

            debug: config.debug
        },
        run: function() {
            var scope = this,
                start_pages = [];

            if (config.userAgent) {
                this.brain.headers['User-Agent'] = config.userAgent;
            }
            tarantula = new Tarantula(this.brain);

            tarantula.on('done', function() {
                scope.brain.onComplete();
                _events.done(scope.brain.output, scope.brain.outputFile);
                return;
            } );

            if(config.start_page){
                start_pages.push(config.start_page);
            } else {
                start_pages = config.start_pages;
            }
            try {
                tarantula.start(start_pages);
            } catch(err) {
                _events.error(err.message);
            }
        }

    };
};

exports.validate = function(json, schema) {

    var schema = schemaEnv.Schema.create(schema),
        validation = schema.validate(json);

    if(validation.isError()) {
        for(var i in validation.errors) {
            //console.log(validation.errors[i]);
            console.log("Error occured near "+validation.errors[i].path+", wrong "+ validation.errors[i].attribute)
        }
    }

}
