# Scraperrr.js

Command-line-based web crawler configured by JSON configurations, defining what data fields to scrape from the visited websites and how to export them as JSON.

This crawler was designed for motion portals in Pirate-Party wikis.
This examples given extract motions of a party assembly and exports them to JSON to be used by the [Spickerrr](https://spickerrr.piraten.tools).


## Installation

    $ npm install -g scraperrr

## Quick Start

Several example configuration are provided in the `presets`-folder.

    $ scraperrr -c presets/lptnrw241_spickerrr.json

This will export a JSON data file with the motions from the wiki.

## Options

| CLI parameter | CLI alias  | config file key | Required | Default   | Description                                                                            |
|---------------|------------|-----------------|----------|-----------|----------------------------------------------------------------------------------------|
| c             | config     |                 | Yes      |           | Configuration file to load                                                             |
| v             | verbose    |                 | No       | false     | Verbose debug print out                                                                |
| p             | politeness | politeness      | No       | 200       | Miliseconds to wait between HTTP requests                                              |
| o             | output     | outputFile      | Yes      |           | The output file to wich the results are written                                        |
| f             | format     | format          | No       | "json"    | The format to be used to create the output file                                        |
| s             | separate   | separate        | No       | false     | If the results should be separated by type                                             |
| ua            | useragent  | userAgent       | No       | -         | The useragent to use for web requests                                                  |
|               |            | event           | No       | "website" | Event name of the Antragsportal to scrape                                              |
|               |            | orderby         | No       | "id"      | Scraped results are ordered by this data field. Data field must be defined in context. |
|               |            | stripHTML       | No       | false     | Remove HTML tags from all scraped fields.                                              |
|               |            | start_page      | No       | ""        | Entry point of scraping the website.                                                   |
|               |            | start_pages     | No       | ""        | Multiple entry point of scraping the website.                                          |
|               |            | regexPortal     | No       | ""        | Regex by which we can detect the Antragsportal                                         |
|               |            | contexts        | Yes      |           | Set of rules by which to scrape given a URL schema                                     |

## Writing own configurations

The config format is still in development and changes occasionally. Once, it is freezed full documentation will be provided.

## Features

  * Flexible configuration files for scraping websites and exporting results to a specified JSON file
  * Waiting period between HTTP-requests

## More Information

  * [Spickerrr on F-Droid](https://f-droid.org/packages/de.piratentools.spickerrr/)
  * [Spickerrr on Github](https://github.com/Piraten-Tools/spickerrr)
  * [Spickerrr Website](https://spickerrr.piraten.tools/)

