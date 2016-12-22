var refdata = require("vaxplan.refdata");
var testcases = require("vaxplan.testcases/test-cases");

console.describe = console.describe || function(target, useDir) {
	var logFunc = useDir ? console.dir : console.log;
	if(Array.isArray(target)) {
		for(var i = 0; i < target.length; i++) {
			console.describe(target[i]);
		}
		return;
	} else if(!target || !target.describe) {
		logFunc(target);
		return;
	}
	logFunc(target.describe());
}

// function ArrayUtil(source) {
// 	this.source = source || [];
// }

// ArrayUtil.prototype.firstOrDefault = function(searchFunc, defaultValue) {
// 	searchFunc = searchFunc || function(item) { return true; };
// 	var result = this.source.find(searchFunc) || defaultValue;
// 	return result;
// }

// ArrayUtil.prototype.lastOrDefault = function(searchFunc, defaultValue) {
// 	searchFunc = searchFunc || function(item) { return true; };
// 	var result;
// 	for(var i = this.source.length; i >= 0; i--) {
// 		if(searchFunc(this.source[i])) return this.source[i];
// 	}
// 	return defaultValue;
// }

Date.TICKS_IN_A_DAY = (24 * 60 * 60 * 1000);

Date.prototype.copy = function(newLabel) {
	var workDate = new Date(this.valueOf());
	var label = (newLabel || this.label);
	(label && (workDate.label = label));
	return workDate;
}

var diffInDays = function(date1, date2) {
	var workDate1 = date1.copy(),
		workDate2 = date2.copy();
	var diff = (workDate2 - workDate1) / Date.TICKS_IN_A_DAY;
	console.log(workDate2.describe() + '-' + workDate1.describe() + ' = ' + diff + ' days');
	return diff;
};

var parseTimeSpan = function(timeSpanText) {
	var timeSpanParser = /\s*([+-]?(?:\s*)\d+)\s*([Dd](?:(?:ays?)?)|[Ww](?:(?:eeks?)?)|[Mm](?:(?:onths?)?)|[Yy](?:(?:ears?)?))\s*,?\s*/gi;
	var regexResult, parsedTimeSpan = {};
	while((regexResult = timeSpanParser.exec(timeSpanText)) != null)
	{
		var quantity = regexResult && regexResult.length >= 2 && regexResult[1] && Number.parseInt(regexResult[1].replace(/\s*/g, ""));
		var units = regexResult && regexResult.length >= 3 && regexResult[2] && regexResult[2].toUpperCase()[0];

		switch(units) {
			case 'D':
				parsedTimeSpan.days = quantity;
				break;
			case 'W':
				parsedTimeSpan.weeks = quantity;
				break;
			case 'M':
				parsedTimeSpan.months = quantity;
				break;
			case 'Y':
				parsedTimeSpan.years = quantity;
				break;
		}
	}

	return parsedTimeSpan;
}

function makeTimeSpanArray(source, keySequence) {
	keySequence = keySequence || [];
	var result = [];
	keySequence.forEach(function(item) {
		var remapped = (Array.isArray(item) && item.length >= 1);
		var sourceKey = remapped ? item[0] : item,
			resultKey = remapped ? item[1] : item;
		var mappedEntry = { name: resultKey, timeSpan: source[sourceKey] };
		result.push(mappedEntry);
	});
	return result;
}

function TimeSpan(timeSpanText, label) {
	this.label = label || timeSpanText;

	var parsedTimeSpan = parseTimeSpan(timeSpanText);

	function formatTime(quantity, unit) {
		return quantity ?
				((quantity > 1 ? "+" : "") + quantity + " " + unit + (Math.abs(quantity) != 1 ? "s" : ""))
				: "";
	}

	this.days = parsedTimeSpan.days || 0;
	this.weeks = parsedTimeSpan.weeks || 0;
	this.months = parsedTimeSpan.months|| 0;
	this.years = parsedTimeSpan.years || 0;
	this.label = label;
	this.source = timeSpanText;
	this.formatted =
			[
			(label != timeSpanText ? "[[" + label + ":" : ""),
			[
				formatTime(parsedTimeSpan.years, 'year'),
				formatTime(parsedTimeSpan.months, 'month'),
				formatTime(parsedTimeSpan.weeks, 'week'),
				formatTime(parsedTimeSpan.days, 'day')
			].reduce(function(previous, current, index, arr) {
				return ((previous || "") + (current && (" " + current))).trim();
			})
			].join(" ")
			+ (label != timeSpanText ? "]]" : "")
	;
}

TimeSpan.parse = function(timeSpanText, label){ return new TimeSpan(timeSpanText, label); };

TimeSpan.prototype.addTo = function(dateValue, label) {
	if((this.years || this.months || this.weeks || this.days) == 0) return dateValue;

	var label = label || this.formatted;
	var workDate = new Date(dateValue.valueOf());
	((dateValue.label || label) && (workDate.label = ((dateValue.label || "") + " " + label).trim()));
	(this.years && (workDate = workDate.addYears(this.years)));
	(this.months && (workDate = workDate.addMonths(this.months)));
	(this.weeks && (workDate = workDate.addWeeks(this.weeks)));
	(this.days && (workDate = workDate.addDays(this.days)));
	return workDate;
};

TimeSpan.prototype.describe = function() {
	return this.formatted;
}

TimeSpan.ZERO = new TimeSpan("0 days");

TimeSpan.fromDays = function(quantity, label) {
	return quantity ? new TimeSpan(quantity + " days", label) : TimeSpan.ZERO;
};

TimeSpan.fromWeeks = function(quantity, label) {
	return quantity ? new TimeSpan(quantity + " weeks", label) : TimeSpan.ZERO;
};

TimeSpan.fromMonths = function(quantity, label) {
	return quantity ? new TimeSpan(quantity + " months", label) : TimeSpan.ZERO;
};

TimeSpan.fromYears = function(quantity, label) {
	return quantity ? new TimeSpan(quantity + " years", label) : TimeSpan.ZERO;
};

Date.prototype.toShortDateString = function() {
	return new Date(this.valueOf()).toLocaleDateString();
};

Date.prototype.diffInDays = function(otherDate) {
	return diffInDays(this, otherDate);
}

Date.prototype.withLabel = function(label) {
	this.label = label;
	// this.label = "[" + label + "]";
	return this;
};

Date.prototype.describe = function() {
	return "[" + (this.label && (this.label + ': ')) + this.toLocaleDateString() + "]";
}

Date.prototype.toString =  function() {
	return this.describe();
};

Date.prototype.addTime = function(toAdd, unit, calcFunc) {
	if(!toAdd) return this;

	var workDate = new Date(this.valueOf());
	(this.label && (workDate.label = "(" + this.label + (toAdd > 0 ? " +" : " ") + "[" + toAdd + " " + unit + (Math.abs(toAdd) > 1 ? "s" : "") + "])"));
	workDate = calcFunc(workDate);
	return workDate;
};

Date.prototype.addDays = function(toAdd) {
	return this.addTime(toAdd, 'day',
		function(workDate) { workDate.setDate(workDate.getDate() + toAdd); return workDate; });
};

Date.prototype.addWeeks = function(toAdd) {
	return this.addTime(toAdd, 'week',
		function(workDate) { workDate.setDate(workDate.getDate() + (toAdd * 7)); return workDate; });
};

Date.prototype.addMonths = function(toAdd) {
	return this.addTime(toAdd, 'month',
		function(workDate) { workDate.setMonth(workDate.getMonth() + toAdd); return workDate; });
};

Date.prototype.addYears = function(toAdd) {
	return this.addTime(toAdd, 'year',
		function(workDate) { workDate.setFullYear(workDate.getFullYear() + toAdd); return workDate; });
};

Date.prototype.addTimeSpan = function(timeSpan, label) {
	var timeSpan = (typeof timeSpan == "TimeSpan" ? timeSpan : TimeSpan.parse(timeSpan, label));
	label = label || timeSpan.label;

	var workDate = new Date(this.valueOf());
	(this.label && (workDate.label = this.label));
	var result = timeSpan.addTo(workDate);
	return result;
}

function createDateRanges(array, rangeStartFunc, endLast) {
	// Example:
	// var logicalRanges = [
	// 	{ name: "Absolute Minimum Age", start: monthsOld2.addDays(-4, "Absolute Minimum Age") },
	// 	{ name: "Minimum Age", start: birthDate.addMonths(2) },
	// 	{ name: "Maximum Age", start: monthsOld2.addMonths(12) }
	// 	];

	// console.dir(logicalRanges);

	// var ranges = createDateRanges(logicalRanges, function(item) { return item.start; });
	// console.dir(ranges.find(birthDate.addMonths(4)));

	endLast = endLast || Date.POSITIVE_INFINITY;
	rangeStartFunc = rangeStartFunc || function(d) { return d; };

	var items = [];

	// establish start value for each item
	array.map(function(item) {
		var start = rangeStartFunc(item);
		(items.find(function(itm) { return itm.start == start; })
		|| (items.push({ value: item, start: start })));
	});

	// sort to ensure accurate range calculations
	items.sort(function(a, b) { return a.start.valueOf() - b.start.valueOf(); });
	
	// establish end values relative to next available item
	items.map(function(item, index, arr) {
		var nextEntry = (index < arr.length - 1 && arr[index + 1].start),
			end = (nextEntry && nextEntry > item.start && nextEntry.addDays(-1));
		item.end = end || item.start;
	});

	(items.length && (items[items.length - 1].end = endLast));

	var result = {
		"find" : function(value, defaultValue) {
			var findResult = items.find(function(item) { return value >= item.start && (value <= item.end); });
			return (findResult && findResult.value) || defaultValue;
		},
		"items": items,
		"describe" : function() {
			var description = items.reduce(function(previous, current, index) {
				var currentText = current && current.value && (current.value.describe || current.value.toString)();
				return (Array.isArray(previous) && previous || []).concat([currentText]);
			}).join('\n');
			return description;
		}
	};

	return result;
}

// ************************************************** 
// * Samples
// ************************************************** 

function getTestCase(testCaseId) {
	return testcases.find(function(item) { return item.TestCaseName == testCaseId; });
}

var testCase = getTestCase("Dose 1 to dose 2 interval 6 months.  Series complete. ");
//var testCase = getTestCase();

function DataShaper() {
}

DataShaper.convertTimeSpansToDateRanges = function(startDate, timeSpanArray, endLast) {
	var dateRanges = createDateRanges(timeSpanArray.map(function(item) {
			item.start = startDate.addTimeSpan(item.timeSpan, item.name);
			return item;
		}),
		function(item) { return item.start; }, endLast);
	dateRanges && dateRanges.items && dateRanges.items.forEach(function(item) {
		item.value.describe = function() { return item.value.name + ' (' + item.value.timeSpan + ') => ' + item.start.toLocaleDateString() + (item.end && '..' + item.end.toLocaleDateString()); };
	});
	return dateRanges;
};

DataShaper.convertAgeToDateRanges = function(birthDate, age) {
	var timeSpanArray = makeTimeSpanArray(age, [
		["absMinAge", "Absolute Minimum Age"],
		["minAge", "Minimum Age"],
		["earliestRecAge", "Earliest Recommended Age"],
		["latestRecAge", "Latest Recommended Age"],
		["max", "Maximum Age"]
	]);

	// Note (JM, 12/21/2016): no endLast specified here...
	var result = DataShaper.convertTimeSpansToDateRanges(birthDate, timeSpanArray);
	return result;
};

function SeriesResolver(refdata) {
	//this.refdata = refdata;
}

SeriesResolver.getAntigenSeries = function(antigen) {
	antigen = (antigen || '').replace(' ', '');
	return refdata.Antigens[antigen].series.map(function(item) {
		var result = {
			seriesName : item.seriesName,
			doses : item.seriesDose.map(function(seriesDose) {
				var age = seriesDose.age && seriesDose.age[0] || {};
				return {
					doseNumber : seriesDose.doseNumber,
					age: age
				};
			})
		};
		return result;
	});
};

SeriesResolver.getAntigenSeriesByCvx = function(cvx) {
	var cvxMatch = refdata.CvxToAntigenMap[cvx];

	var antigens = cvxMatch && cvxMatch.association && cvxMatch.association.map(function(item) {
		return item.antigen;
	}) || [];

	var firstAntigen = antigens && antigens.length && antigens[0];
	var antigenSeries = firstAntigen && SeriesResolver.getAntigenSeries(firstAntigen);
	return antigenSeries;
};

function PatientProfileBuilder() {
}

PatientProfileBuilder.fromTestCase = function (testCase) {
	var patientProfile = testCase.PatientProfile;

	return {
		name: testCase.TestCaseName,
		birthDate: new Date(Date.parse(patientProfile.Dob)).withLabel("Birth Date"),
		immunizationHistory: patientProfile.Series.map(function(item, index) {
			return {
				administeredDate : new Date(Date.parse(item.DateAdministered)),
				vaccineName : item.VaccineName,
				doseNumber : index + 1,
				cvx : item.Cvx
			}
		})
	}
};

function runTestCase(testCaseName) {
	var testCase = getTestCase(testCaseName);
	var patientProfile = PatientProfileBuilder.fromTestCase(testCase);

	var birthDate = patientProfile.birthDate,
		immunizationHistory = patientProfile.immunizationHistory, 
		firstDose = immunizationHistory.find(function(item) { return item.doseNumber == 1; }),
		administeredDate = firstDose.administeredDate.withLabel("Administered Date"),
		seriesDoses = SeriesResolver.getAntigenSeriesByCvx(firstDose && firstDose.cvx)
		;

	var firstDoseAge = seriesDoses[0].doses[0].age;

	var doseAgeDateRanges = DataShaper.convertAgeToDateRanges(birthDate, firstDoseAge);
	var doseAgeMatch = doseAgeDateRanges.find(administeredDate, "Too early timeSpan");

	console.describe([
		'\n**********',
		'\nPatient:', patientProfile.name,
		'\nBirth Date:', patientProfile.birthDate,
		'\nAdministered Date:', administeredDate,
		'\nDose Age Date Ranges:', doseAgeDateRanges,
		'\nDose Age Match', administeredDate, doseAgeMatch,
		'\n----------\nCVX Dose Series', seriesDoses,
		'\n**********\n'
		]);

	//var diff = birthDate.diffInDays(administeredDate);
}

var selectedTestCases = [ "DTaP # 2 at age 4 months", "Dose 1 to dose 2 interval 6 months.  Series complete. " ];
selectedTestCases.forEach(function(selected) { runTestCase(selected); });
