(function() {

var refdata = require("vaxplan.refdata");
var testCases = require("vaxplan.testcases/test-cases");
var vaxplan = require("vaxplan.core");
var CdsiDate = require("vaxplan.dates");

console.describe = console.describe || function(target, useDir) {
	var logFunc = useDir ? console.dir : console.log;
	if(Array.isArray(target)) {
		for(var i = 0; i < target.length; i++) {
			console.describe(target[i]);
		}
		return target;
	} else if(!target || !target.describe) {
		logFunc(target);
		return target;
	}
	logFunc(target.describe());
	return target;
}

function unfiltered(item) { return item; }
function alwaysTrue() { return true; }
function isFunction(item) { return typeof item === "function"; }
function defaultIfMissing(defaultValue) { return function(value) { return value || defaultValue; } }

/********************************
 * TimeSpan
 ********************************/

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
		// if an array is passed, the first element is the original property name, and the second element is the remapped property name
		var remapped = (Array.isArray(item) && item.length >= 1);
		var sourceKey = remapped ? item[0] : item,
			resultKey = remapped ? item[1] : item,
			filterFunc = (remapped && item[2] && (isFunction(item[2]) ? item[2] : defaultIfMissing(item[2]))) || unfiltered,
			timeSpanText = filterFunc(source[sourceKey]);
		var mappedEntry = { name: resultKey, timeSpan: timeSpanText };
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

TimeSpan.UNREACHABLE_AGE = new TimeSpan("999 years", "UNREACHABLE AGE");

/********************************
 * Date prototype modifications
 ********************************/

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
	var diff = new Number((workDate2 - workDate1) / Date.TICKS_IN_A_DAY);
	diff.describe = function() { return workDate2.describe() + '-' + workDate1.describe() + ' = ' + diff + ' days'; };
	return diff;
};

Date.prototype.toShortDateString = function() {
	return new Date(this.valueOf()).toLocaleDateString();
};

Date.prototype.diffInDays = function(otherDate) {
	return diffInDays(this, otherDate);
}

Date.prototype.withLabel = function(label) {
	this.label = label;
	return this;
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

Date.prototype.describe = function() {
	return "[" + (this.label && (this.label + ': ')) + this.toShortDateString() + "]";
}

/************************
 * Date Ranges
 ************************/

function createDateRanges(array, rangeStartFunc, endLast, requireUnique) {
	requireUnique = requireUnique || false;

	endLast = endLast || Date.POSITIVE_INFINITY;
	rangeStartFunc = rangeStartFunc || function(d) { return d; };

	var items = [];

	// establish start value for each item
	array.map(function(item) {
		var start = rangeStartFunc(item);
		if(requireUnique && items.find(function(itm) { return itm.start == start; })) {
			return;
		}
		items.push({ value: item, start: start });
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
			var description = this.items.map(function(item) {
				return (item && item.value && (item.value.describe || item.value.toString)());
			}).join('\n');
			return description;
		}
	};

	return result;
}

function DataShaper() { }

DataShaper.convertTimeSpansToDateRanges = function(startDate, timeSpanArray, endLast) {
	var mappedTimeSpans = timeSpanArray.map(function(item) {
			item.start = startDate.addTimeSpan(item.timeSpan, item.name);
			return item;
		});
	var dateRanges = createDateRanges(mappedTimeSpans, function(item) { return item.start; }, endLast);
	dateRanges && dateRanges.items && dateRanges.items.forEach(function(item) {
		item.value.describe = function() { return item.value.name + ' (' + item.value.timeSpan + ') => ' + item.start.toShortDateString() + (item.end && '..' + item.end.toShortDateString()); };
	});
	return dateRanges;
};

DataShaper.convertAgeToDateRanges = function(birthDate, age) {
	var timeSpanArray = makeTimeSpanArray(age, [
		["absMinAge", "Absolute Minimum Age"],
		["minAge", "Minimum Age"],
		["earliestRecAge", "Earliest Recommended Age"],
		["latestRecAge", "Latest Recommended Age"],
		["maxAge", "Maximum Age", TimeSpan.UNREACHABLE_AGE.source]
	]);

	var endLast = birthDate.addTimeSpan(TimeSpan.UNREACHABLE_AGE.source);

	var result = DataShaper.convertTimeSpansToDateRanges(birthDate, timeSpanArray, endLast);

	return result;
};

function SeriesResolver() { }

SeriesResolver.getAntigenSeries = function(antigen) {
	antigen = (antigen || '').replace(' ', '');
	return refdata.AntigenSeriesByName[antigen].series.map(function(item) {
		var result = {
			seriesName : item.seriesName,
			doses : item.seriesDose.map(function(seriesDose) {
				var age = seriesDose.age && seriesDose.age[0] || {};
				return {
					doseNumber : seriesDose.doseNumber,
					age: age
				};
			}),
			describe : function() { return ['Series Name: ' + this.seriesName + ' (' + this.doses.length + ' doses)'].join('\n'); }
		};
		return result;
	});
};

SeriesResolver.getAntigenSeriesByCvx = function(cvx) {
	var cvxMatch = refdata.AntigenSeriesByCvx[cvx];

	var antigens = cvxMatch && cvxMatch.association && cvxMatch.association.map(function(item) {
		return item.antigen;
	}) || [];

	var firstAntigen = antigens && antigens.length && antigens[0];
	var antigenSeries = firstAntigen && SeriesResolver.getAntigenSeries(firstAntigen);
	return antigenSeries;
};

function PatientProfileBuilder() { }

PatientProfileBuilder.fromTestCase = function(testCase) {
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

function TestRunner() {

}

TestRunner.getTestCase = function(testCaseId) {
	return testCases.find(function(item) { return (item.TestCaseName || '').trim() == (testCaseId || '').trim(); });
};

 
TestRunner.runTestCase = function (testCaseName) {
	var testCase = TestRunner.getTestCase(testCaseName);
	var patientProfile = PatientProfileBuilder.fromTestCase(testCase);

	var birthDate = patientProfile.birthDate,
		immunizationHistory = patientProfile.immunizationHistory, 
		firstDose = immunizationHistory.find(function(item) { return item.doseNumber == 1; }),
		administeredDate = firstDose.administeredDate.withLabel("Administered Date"),
		seriesDoses = SeriesResolver.getAntigenSeriesByCvx(firstDose && firstDose.cvx)
		;

	var firstSeries = seriesDoses[0];
	var firstDoseAge = firstSeries.doses[0].age;

	var doseAgeDateRanges = DataShaper.convertAgeToDateRanges(birthDate, firstDoseAge);
	var doseAgeMatch = doseAgeDateRanges.find(administeredDate, "Too early");

	console.describe([
		'=================================================================================',
		'| Patient: ' + patientProfile.name,
		'=================================================================================',
		'\nBirth Date:', patientProfile.birthDate,
		'\nAdministered Date:', administeredDate,
		'\nThis date best matches in the following date range:', doseAgeMatch,
		'\nAge in Days:', birthDate.diffInDays(administeredDate),
		'\nSelected Series:', firstSeries,
		'\nFirst Dose Age (raw):', firstDoseAge, 
		'\nDose Age Date Ranges:', doseAgeDateRanges,
		'\n\nCVX Dose Series available...', seriesDoses,
		'\n=================================================================================\n\n',
		]);
}

// ************************************************** 
// * Samples
// ************************************************** 

var selectedTestCases = [ "DTaP # 2 at age 4 months", "Dose 1 to dose 2 interval 6 months.  Series complete." ];
selectedTestCases.forEach(function(selected) { TestRunner.runTestCase(selected); });

// Note (JM, 12/22/2016): TODO: break this up into modules with exports

})();
