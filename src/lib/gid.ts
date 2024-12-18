import crypto from "crypto";
import moment from "moment";

/**
 * Return a text, with text length = getCurrentDateByFormat length + randomString length.
 *
 * If the length is shorter than getCurrentDateByFormat length, langth = getCurrentDateByFormat length
 *
 * @param length Default 17 charactor
 * @param dateFormat Default YYYYMMDDhhmmss
 * @returns
 */
export const GID = (length = 17, dateFormat = "YYYYMMDDhhmmss") => {
	const dateStr = getCurrentDateByFormat(dateFormat);
	let randomLength = length - dateStr.length;

	if (randomLength < 0) {
		randomLength = 0;
	}

	const randomStr = randomString(randomLength);
	return dateStr + randomStr;
};

const randomString = (length: number) => {
	const random = crypto.randomBytes(Math.ceil(length / 2)).toString("hex");
	return random.slice(-length);
};

const getCurrentDateByFormat = (dateFormat: string) => {
	const date = moment();
	return date.format(dateFormat) + date.millisecond();
};
