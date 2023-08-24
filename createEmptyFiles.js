const fs = require("fs");
const mainPath = require("oberknecht-utils/lib/utils/mainPath");

fs.writeFileSync(mainPath("./input/filters.txt"), "// $(<keyname>) <(<|>|=|!==)> <something>\n");
fs.writeFileSync(mainPath("./input/twitchchannelname.txt"), "// The channel name\nTwitch Name");
fs.writeFileSync(mainPath("./input/twitchnamekey.txt"), "// Row Name including Twitch Names\n");