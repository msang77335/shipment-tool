/* eslint-disable max-len */
declare module "neopay-lib/helpers" {
	export const MapperHelper: {
		/** MapObj: mapping object  format data output
		 * @output object formatted props follow by targetObj
		 * @param sourceObj: object data input
		 * @param targetObj: object format data output
		 */
		mapObj(sourceObj, targetObj): any;

		/** mapListObj: mapping object format data output
		 * @output array object formatted props follow by targetObj
		 * @param sourceList: list object data input
		 * @param targetObj: object format data output
		 */
		mapListObj(sourceList, targetObj): any;
	};

	export const HashicorpVaultHelper: {
		getSecretData(
			endpoint: string,
			apiVersion: string,
			roleId: string,
			secretId: string,
			secretPath: string
		): { data: object; status: string; error: object | string };
	};

	export const MongoFuncHelper: {
		/** Create entity model
		 * @output object model created
		 * @param model current model working
		 * @param entParam object entity model need to create*/
		$save(model, entParam): Promise<any>;

		/** Update entity model
		 * @output object model created
		 * @param model current model working
		 * @param conditionObj object use to filter record need to update
		 * @param newObj object entity model was set value need to update
		 * */
		$updateOne(model, conditionObj, newObj): Promise<any>;

		/** Update entity model
		 * @output object model created
		 * @param model current model working
		 * @param filterObj object use to filter record need to update
		 * @param setObj object entity model was set value need to update
		 * */
		$updateSet(model, filterObj, setObj): Promise<any>;

		/** Since upsert creates a document if not finds a document, you don't need to create another one manually.
		 *
		 * @param {*} model current model working
		 * @param {*} entParam object entity model need to create or update
		 * @param filter
		 * @returns
		 */
		$findOneAndUpdateOrCreate(model, entParam, filter = {}): Promise<any>;

		/** Get all entity model
		 * @output array entity model
		 * @param model current model working
		 * @param filter object contains filter props
		 * @param sort object contains sort props
		 * @param select object contains props name need to get*/
		$getAll(model, filter = {}, sort = {}, select = {}): Promise<any>;

		/** Get detail entity model
		 * @output object entity model
		 * @param model current model working
		 * @param _id entity model
		 * @param isWithOutCheckDelete type boolean
		 * @param select object contains props name need to get*/
		$getById(model, _id, isWithOutCheckDelete = false, select = {}): Promise<any>;

		/** Get list entity model- usually use for mobile app logic
		 * @output array entity model
		 * @param model current model working
		 * @param query object contains query props
		 * @param sort object contains sort props
		 * @param skip int number records will skip
		 * @param limit int number records need to get
		 * @param select object contains props name need to get*/
		$list(model, query = {}, sort = {}, skip = 0, limit = 20, select = {}): Promise<any>;

		/** Get list entity model paging - usually use for web portal logic
		 * @output array entity model
		 * @param model current model working
		 * @param query object contains query props
		 * @param sort object contains sort props
		 * @param pageIndex int current page
		 * @param limit int number records need to get every page
		 * @param select object contains props name need to get*/
		$listPaging(model, query = {}, sort = {}, pageIndex = 0, limit = 20, select = {}): Promise<any>;

		/** Find a entity model
		 * @output object entity model
		 * @param model current model working
		 * @param filter object contains query props
		 * @param isWithOutCheckDelete type boolean
		 * @param select object contains props name need to get*/
		$findOne(model, filter, isWithOutCheckDelete = false, select = {}): Promise<any>;

		/** Find a entity model with sorting
		 * @output object entity model
		 * @param model current model working
		 * @param filter object contains query props
		 * @param isWithOutCheckDelete type boolean
		 * @param sorting sorting object
		 * @param select object contains props name need to get*/
		$findOneAndSort(model, filter, isWithOutCheckDelete = false, sorting = {}, select = {}): Promise<any>;

		/** Get lastest item with
		 * @output object entity model
		 * @param model current model working*/
		$getLastItem(model): Promise<any>;

		/** Get list entity model
		 * @output array entity model
		 * @param model is current model working
		 * @param aggregateFilters is array contains query aggregate props*/
		$aggregate(model, aggregateFilters = []);

		/** Get a object paging list entity model
		 * @output array entity model
		 * @param model is current model working
		 * @param aggregateFilters is array contains query aggregate props
		 * @param options is object as: {page, limit, sort}*/
		$aggregatePaging(model, aggregateFilters = [], options = { page: 1, limit: 10 }): Promise<any>;

		/** Get a list entity model
		 * @output array entity model
		 * @param model is current model working
		 * @param listId is array _id
		 * @param sort is object contain sorting props
		 * @param select is object contain props name need to get*/
		$findByListId(model, listId, sort = {}, select = {}): Promise<any>;

		/** Set isActive prop of a entity model
		 * @output object mongo result updating
		 * @param model is current model
		 * @param _id is _id of entity model need to get
		 * @param isActive is value need to update*/
		$setIsActive(model, _id, isActive): Promise<any>;

		/** Set isDelete prop of a entity model
		 * @output object mongo result updating
		 * @param model is current model
		 * @param _id is _id of entity model need to get
		 * @param isDelete is value need to update*/
		$setIsDelete(model, _id, isDelete): Promise<any>;

		/** Get a entity model via code prop
		 * @output object entity model
		 * @param model is current model
		 * @param code is value need to query
		 * @param select is object contain props name need to get
		 * @param isWithOutCheckDelete type boolean*/
		$getByCode(model, code, select = {}, isWithOutCheckDelete = false): Promise<any>;

		/** Get list entity model were set isDelete is true
		 * @output list object entity model
		 * @param model is current model
		 * @param filter object contains more query props
		 * @param sort object contains sort props*/
		$getAllDeleteItems(model, filter = {}, sort = {}): Promise<any>;

		/** Count number of entity model
		 * @output number records entity model
		 * @param model is current model working
		 * @param filter is contain query props*/
		$count(model, filter = {}): Promise<any>;

		/** Create many entity model
		 * @output object model created
		 * @param model current model working
		 * @param listItem list object entity model need to create*/
		$saveMany(model, listItem): Promise<any>;

		/** Update many entity model
		 * @output object model created
		 * @param model current model working
		 * @param filterObj object filter
		 * @param setObj object update
		 * @param options object*/
		$updateMany(model, filterObj, setObj, options = {}): Promise<any>;

		/** Convert value to mongoId
		 * @output array _id or _id
		 * @param params array value or string value*/
		convertToMongoId(params): any;

		/** Update many entity model
		 * @output object result updating
		 * @param model current model working
		 * @param filterObj object filter
		 * @param setObj object update
		 * @param options object: {arrayFilters = []} */
		$findOneAndUpdate(model, filterObj, setObj, options = {}): Promise<any>;

		/** Delete many entity model
		 * @output object result deleting
		 * @param model current model working
		 * @param filterObj object filter
		 * @param options */
		$deleteMany(model, filterObj, options = {}): Promise<any>;

		/** Delete one entity model
		 * @output object result deleting
		 * @param model current model working
		 * @param options
		 * @param filterObj object filter */
		$deleteOne(model, filterObj, options = {}): Promise<any>;

		$distinct(model, field, filterObj = {}): Promise<any>;
	};

	export const RequestHelper: {
		/** Get params via context
		 * @param context
		 * @output object params*/
		getParams(context): any;

		/** Private functions use for this service */
		getCurrentAccount(context): any;

		getLangCode(context): any;

		/** Sanitize request param
		 * @param req
		 * @output params valid or null*/
		sanitizeParam(req): any;
	};

	export const ResponseHelper: {
		/** Processing result return to publish actions
		 * @param data data will return
		 * @param state
		 * @output { code, state data, message }
		 */
		resOK(data, state?): any;

		/** Processing result return to publish actions
		 * @output  { code, state data, message }
		 * @param definedCodeObj: object { CODE, MESSAGE, STATUS_CODE } defined
		 * @param state
		 * @param [data]: object custom failed
		 * @param langCode: language code as en, vi.. Default is en
		 */
		resFailed(definedCodeObj, state, langCode = "EN", data = undefined): any;

		/** Processing result return from service to gateway
		 * @output  { code, data, message }
		 * @param dataService
		 * @param res
		 */
		resGateway(dataService, res): any;

		/** Processing result return from service to gateway
		 * @output void || end request -> send response to client
		 * @param res
		 * @param statusCode
		 * @param code
		 * @param message
		 * @param data
		 * @param headers
		 */
		resToClient(
			res,
			statusCode,
			code,
			message,
			data = undefined,
			headers = { "Content-Type": "application/json" }
		): any;

		/** Processing result return to publish actions
		 * @param data data will return
		 * @param state
		 * @output { code, state data, message }
		 */
		resOKPGW(data, state = STATE.DONE): any;

		/** Processing result return to publish actions
		 * @output  { code, state data, message }
		 * @param definedCodeObj: object { CODE, MESSAGE, STATUS_CODE } defined
		 * @param state
		 * @param [data]: object custom failed
		 * @param langCode: language code as en, vi.. Default is en
		 */
		resFailedPGW(definedCodeObj, state, langCode = "EN", data = undefined): any;
	};

	export const FunctionHelper: {
		/** Convert string to unicode
		 * @param str string value
		 * @output string result
		 */
		convertUnicode(str): string;

		/** Generate random a string with number format
		 * @param length numbers characters
		 * @param startString character start
		 * @param endString character end
		 * @param delimiter character delimiter
		 * @output string result
		 */
		generateRandomNumber(length, startString = "", endString = "", delimiter = ""): string;

		/** Generate random a upper string
		 * @param length numbers characters
		 * @param startString character start
		 * @param endString character end
		 * @param delimiter character delimiter
		 * @output string result
		 */
		generateRandomUpperString(length, startString = "", endString = "", delimiter = ""): string;

		/** Generate random a string with a patter
		 * @param pattern characters
		 * @param length numbers characters
		 * @param option numbers characters
		 * @param startString character start
		 * @param endString character end
		 * @param delimiter character delimiter
		 * @output string result
		 */
		generateRandomStringCustom(
			pattern,
			length,
			option = {},
			startString = "",
			endString = "",
			delimiter = ""
		): string;

		/** Remove all space and special characters of a string
		 * @param text string value input
		 * @output string result
		 */
		removeAllSpaceAndSpecialChars(text): string;

		/** Convert string to key code
		 * @param text string value input
		 * @output string result
		 */
		convertToKeyCode(text): string;

		/** Compare 2 json
		 * @param jsonObj object json need to compare
		 * @param compareJsonObj object json use to compare
		 * @output boolean value
		 */
		jsonCompare(jsonObj, compareJsonObj): boolean;

		/** Find a character in a string
		 * @param str string value input
		 * @param charToCount character need to find
		 * @output number value
		 */
		findOccurrences(str, charToCount): number;

		/** Replace string with specific
		 * @param str string value input
		 * @param strRep value need to replace
		 * @param strRep value use to replace
		 * @output string replaced
		 */
		replaceString(str, strRep, repStr): string;

		/** Get first character of string
		 * @param str string value input
		 * @output string result
		 */
		getFirstCharsOfString(str): string;

		/** Trim all fields of a object or array objects
		 * @param obj dynamic value object or array object
		 * @output result
		 */
		trimDynamic(obj): any;

		/** Get current date format from date timestamp value
		 * @param date number timestamp
		 * @param dateFm
		 * @output result
		 */
		getCurrentDateByFormat(date = Date.now(), dateFm = "yyyymmdd-hhMMss"): any;

		/** Convert value to date
		 * @param inputParams number timestamp or string datetime
		 * @output result date object
		 */
		convertToDate(inputParams): any;

		/** Convert string value to date
		 * @param strDate number timestamp or string datetime
		 * @param typeFrm format date
		 * @output result date object
		 */
		convertStringToDate(strDate, typeFrm = "yyyy-MM-dd"): any;

		/** Convert string value to number
		 * @param strNum string number value
		 * @output result number
		 */
		convertStringToNumber(strNum): number;

		/** Convert string value to number
		 * @param dateTime string or number timestamp
		 * @param numberDayAgo a number day will skip
		 * @param isOnlyGetDate just only get date need not time
		 * @output result date iso
		 */
		convertDateTimeToStringISO(dateTime, numberDayAgo = 0, isOnlyGetDate = true): string;

		/** Validate email address
		 * @param email string
		 * @output result boolean
		 */
		validateEmailAddress(email): boolean;

		/** Validate string is format phone number
		 * @param strPhone string number value
		 * @output result boolean
		 */
		validPhoneNumber(strPhone): boolean;

		/** Convert a string to a phone number format
		 * @param strPhone string number value
		 * @output result string
		 */
		convertStringToPhone(strPhone): string;

		/** Get date string format
		 * @param date string number value
		 * @output result string
		 */
		getDateStringFormat(date = null): string;

		/** Set content child properties by language code
		 * @param contentObj object data processing
		 * @param languageCode string language code
		 * @output object mapped value via language code */
		translateContent(contentObj, languageCode = "vi"): any;

		/** Convert value to mongoId
		 * @output array _id or _id
		 * @param params array value or string value */
		convertToMongoId(params): any[];

		/** Check input param is empty
		 * @param inputValue: param value need to checking
		 * @output true || false */
		isEmpty(inputValue): boolean;

		/** Random a string contains only number
		 * @param length
		 * @output string number */
		randomStringNumber(length): string;

		/** Check string is valid phone format
		 * @param value
		 * @output true || false */
		isPhoneNumber(value): boolean;

		/** Get full string address
		 * @param province
		 * @param district
		 * @param ward
		 * @param address
		 * @output address full */
		getFullTextAddress(province, district, ward, address): string;

		/** Get full string address by location object
		 * @param locationDataObj
		 * @output address full */
		getFullTextAddressByLocation(locationDataObj): string;

		/** Check have special characters in str */
		isHaveSpecialChars(str): boolean;

		/** Get regex filter equal from string without lower or upper for MONGO
		 * @param str
		 * @output regex */
		getRegexStringEqualMongo(str): string;

		/** Get regex filter start with from string without lower or upper for MONGO
		 * @param str
		 * @output regex */
		getRegexStringStartWithMongo(str): string;

		/** Get regex filter contain with from string without lower or upper for MONGO
		 * @param str
		 * @output regex */
		getRegexStringContainWithMongo(str): string;

		/** checkPasswordPolicy
		 * @param pwdPolicy object
		 * @param pwd string
		 * @output regex */
		checkPasswordPolicy(pwdPolicy = {}, pwd = ""): string;

		/** Check string is empty
		 * @param str string input
		 * @output boolean: true or false */
		stringIsEmpty(str): boolean;

		/** Check string is blank
		 * @param str string input
		 * @output boolean: true or false */
		stringIsBlank(str): boolean;

		/** Check string is blank
		 * @param str string input
		 * @output boolean: true or false */
		stringIsEmptyOrBlank(str): boolean;

		/** Validation object with defining data type
		 * @param definedInput object
		 * @param paramInput object
		 * @param parentName
		 * @param resOut
		 * @output object {result: boolean, listFieldErr = [{key, message}]}*/
		validateParam(definedInput, paramInput = {}, parentName = "", resOut = {}): object;

		/** Convert number to currency with locales */
		convertNumberToCurrency(valueNumber, locales = "vi-VN", currencyFormat = "vnd"): string;

		/** Wrapper message defined with values */
		putValueToMessage(msgDefinedObj, valObj): any;

		timeBaseUUIDGenerator(length = 12): string;

		/** Format amount (+) or (-)
		 * @param transType type of transaction
		 * @param value amount
		 * @output amount with sign */
		formatMoneyVal(currentUserPhone, senderPhone, receiverPhone, value, transType = null): string;

		removeAccents(str): string;

		/** translate number to string
		 * @param number number
		 * @output translated number */
		numberToString(number): string;
	};

	export const EncryptHelper: {
		encrypt(text): string;

		decrypt(text): string;

		encryptIv(text): string;

		decryptIv(text): string;

		encryptBase64(text): string;

		decryptBase64(text): string;

		encryptBase64Object(obj): string;

		decryptBase64Object(obj): string;

		desEcbEncrypt(plaintext, key): string;

		desEcbDecrypt(plaintext, key): string;

		hashMD5(plaintext): string;

		hashSHA256(plaintext): string;
	};

	export const SqlFuncHelper: {
		/** Get all entity model
		 * @output array entity model
		 * @param dbConnection
		 * @param filter object contains filter props
		 * @param sort object contains sort props
		 * @param select object contains props name need to get*/
		$getAll(dbConnection, sqlRequest = {}, sort = {}, select = {}): any;
	};

	export const LoggerHelper: {
		getFormatLogGwAC(reqObj): string;

		getFormatLogGwOUT(resObj): string;

		getFormatLogSvIN(inObj): string;

		getFormatLogSvOUT(outObj): string;

		/** Process hide secret value */
		processIgnoreFields(objProc, ignoreFields): string;
	};
}

declare module "neopay-lib/defined/state-code" {
	export enum HTTP_STATUS_CODES {
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.3
		 *
		 * The request has been received but not yet acted upon. It is non-committal, meaning that there is no way in HTTP to later send an asynchronous response indicating the outcome of processing the request. It is intended for cases where another process or server handles the request, or for batch processing.
		 */
		ACCEPTED = 202,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.3
		 *
		 * This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.
		 */
		BAD_GATEWAY = 502,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.1
		 *
		 * This response means that server could not understand the request due to invalid syntax.
		 */
		BAD_REQUEST = 400,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.8
		 *
		 * This response is sent when a request conflicts with the current state of the server.
		 */
		CONFLICT = 409,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.1
		 *
		 * This interim response indicates that everything so far is OK and that the client should continue with the request or ignore it if it is already finished.
		 */
		CONTINUE = 100,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.2
		 *
		 * The request has succeeded and a new resource has been created as a result of it. This is typically the response sent after a PUT request.
		 */
		CREATED = 201,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.14
		 *
		 * This response code means the expectation indicated by the Expect request header field can't be met by the server.
		 */
		EXPECTATION_FAILED = 417,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.5
		 *
		 * The request failed due to failure of a previous request.
		 */
		FAILED_DEPENDENCY = 424,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.3
		 *
		 * The client does not have access rights to the content, i.e. they are unauthorized, so server is rejecting to give proper response. Unlike 401, the client's identity is known to the server.
		 */
		FORBIDDEN = 403,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.5
		 *
		 * This error response is given when the server is acting as a gateway and cannot get a response in time.
		 */
		GATEWAY_TIMEOUT = 504,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.9
		 *
		 * This response would be sent when the requested content has been permenantly deleted from server, with no forwarding address. Clients are expected to remove their caches and links to the resource. The HTTP specification intends this status code to be used for "limited-time, promotional services". APIs should not feel compelled to indicate resources that have been deleted with this status code.
		 */
		GONE = 410,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.6
		 *
		 * The HTTP version used in the request is not supported by the server.
		 */
		HTTP_VERSION_NOT_SUPPORTED = 505,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2324#section-2.3.2
		 *
		 * Any attempt to brew coffee with a teapot should result in the error code "418 I'm a teapot". The resulting entity body MAY be short and stout.
		 */
		IM_A_TEAPOT = 418,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.6
		 *
		 * The 507 (Insufficient Storage) status code means the method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request. This condition is considered to be temporary. If the request which received this status code was the result of a user action, the request MUST NOT be repeated until it is requested by a separate user action.
		 */
		INSUFFICIENT_SPACE_ON_RESOURCE = 419,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.6
		 *
		 * The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.
		 */
		INSUFFICIENT_STORAGE = 507,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.1
		 *
		 * The server encountered an unexpected condition that prevented it from fulfilling the request.
		 */
		INTERNAL_SERVER_ERROR = 500,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.10
		 *
		 * The server rejected the request because the Content-Length header field is not defined and the server requires it.
		 */
		LENGTH_REQUIRED = 411,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.4
		 *
		 * The resource that is being accessed is locked.
		 */
		LOCKED = 423,
		/**
		 * @deprecated
		 * Official Documentation @ https://tools.ietf.org/rfcdiff?difftype=--hwdiff&url2=draft-ietf-webdav-protocol-06.txt
		 *
		 * A deprecated response used by the Spring Framework when a method has failed.
		 */
		METHOD_FAILURE = 420,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.5
		 *
		 * The request method is known by the server but has been disabled and cannot be used. For example, an API may forbid DELETE-ing a resource. The two mandatory methods, GET and HEAD, must never be disabled and should not return this error code.
		 */
		METHOD_NOT_ALLOWED = 405,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.2
		 *
		 * This response code means that URI of requested resource has been changed. Probably, new URI would be given in the response.
		 */
		MOVED_PERMANENTLY = 301,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.3
		 *
		 * This response code means that URI of requested resource has been changed temporarily. New changes in the URI might be made in the future. Therefore, this same URI should be used by the client in future requests.
		 */
		MOVED_TEMPORARILY = 302,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.2
		 *
		 * A Multi-Status response conveys information about multiple resources in situations where multiple status codes might be appropriate.
		 */
		MULTI_STATUS = 207,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.1
		 *
		 * The request has more than one possible responses. User-agent or user should choose one of them. There is no standardized way to choose one of the responses.
		 */
		MULTIPLE_CHOICES = 300,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-6
		 *
		 * The 511 status code indicates that the client needs to authenticate to gain network access.
		 */
		NETWORK_AUTHENTICATION_REQUIRED = 511,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.5
		 *
		 * There is no content to send for this request, but the headers may be useful. The user-agent may update its cached headers for this resource with the new ones.
		 */
		NO_CONTENT = 204,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.4
		 *
		 * This response code means returned meta-information set is not exact set as available from the origin server, but collected from a local or a third party copy. Except this condition, 200 OK response should be preferred instead of this response.
		 */
		NON_AUTHORITATIVE_INFORMATION = 203,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.6
		 *
		 * This response is sent when the web server, after performing server-driven content negotiation, doesn't find any content following the criteria given by the user agent.
		 */
		NOT_ACCEPTABLE = 406,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.4
		 *
		 * The server can not find requested resource. In the browser, this means the URL is not recognized. In an API, this can also mean that the endpoint is valid but the resource itself does not exist. Servers may also send this response instead of 403 to hide the existence of a resource from an unauthorized client. This response code is probably the most famous one due to its frequent occurence on the web.
		 */
		NOT_FOUND = 404,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.2
		 *
		 * The request method is not supported by the server and cannot be handled. The only methods that servers are required to support (and therefore that must not return this code) are GET and HEAD.
		 */
		NOT_IMPLEMENTED = 501,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7232#section-4.1
		 *
		 * This is used for caching purposes. It is telling to client that response has not been modified. So, client can continue to use same cached version of response.
		 */
		NOT_MODIFIED = 304,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1
		 *
		 * The request has succeeded. The meaning of a success varies depending on the HTTP method:
		 * GET: The resource has been fetched and is transmitted in the message body.
		 * HEAD: The entity headers are in the message body.
		 * POST: The resource describing the result of the action is transmitted in the message body.
		 * TRACE: The message body contains the request message as received by the server
		 */
		OK = 200,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7233#section-4.1
		 *
		 * This response code is used because of range header sent by the client to separate download into multiple streams.
		 */
		PARTIAL_CONTENT = 206,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.2
		 *
		 * This response code is reserved for future use. Initial aim for creating this code was using it for digital payment systems however this is not used currently.
		 */
		PAYMENT_REQUIRED = 402,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7538#section-3
		 *
		 * This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header. This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
		 */
		PERMANENT_REDIRECT = 308,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7232#section-4.2
		 *
		 * The client has indicated preconditions in its headers which the server does not meet.
		 */
		PRECONDITION_FAILED = 412,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-3
		 *
		 * The origin server requires the request to be conditional. Intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict.
		 */
		PRECONDITION_REQUIRED = 428,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.1
		 *
		 * This code indicates that the server has received and is processing the request, but no response is available yet.
		 */
		PROCESSING = 102,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7235#section-3.2
		 *
		 * This is similar to 401 but authentication is needed to be done by a proxy.
		 */
		PROXY_AUTHENTICATION_REQUIRED = 407,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-5
		 *
		 * The server is unwilling to process the request because its header fields are too large. The request MAY be resubmitted after reducing the size of the request header fields.
		 */
		REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.7
		 *
		 * This response is sent on an idle connection by some servers, even without any previous request by the client. It means that the server would like to shut down this unused connection. This response is used much more since some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing. Also note that some servers merely shut down the connection without sending this message.
		 */
		REQUEST_TIMEOUT = 408,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.11
		 *
		 * Request entity is larger than limits defined by server; the server might close the connection or return an Retry-After header field.
		 */
		REQUEST_TOO_LONG = 413,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.12
		 *
		 * The URI requested by the client is longer than the server is willing to interpret.
		 */
		REQUEST_URI_TOO_LONG = 414,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7233#section-4.4
		 *
		 * The range specified by the Range header field in the request can't be fulfilled; it's possible that the range is outside the size of the target URI's data.
		 */
		REQUESTED_RANGE_NOT_SATISFIABLE = 416,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.6
		 *
		 * This response code is sent after accomplishing request to tell user agent reset document view which sent this request.
		 */
		RESET_CONTENT = 205,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.4
		 *
		 * Server sent this response to directing client to get requested resource to another URI with an GET request.
		 */
		SEE_OTHER = 303,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.4
		 *
		 * The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded. Note that together with this response, a user-friendly page explaining the problem should be sent. This responses should be used for temporary conditions and the Retry-After: HTTP header should, if possible, contain the estimated time before the recovery of the service. The webmaster must also take care about the caching-related headers that are sent along with this response, as these temporary condition responses should usually not be cached.
		 */
		SERVICE_UNAVAILABLE = 503,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.2
		 *
		 * This code is sent in response to an Upgrade request header by the client, and indicates the protocol the server is switching too.
		 */
		SWITCHING_PROTOCOLS = 101,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.7
		 *
		 * Server sent this response to directing client to get requested resource to another URI with same method that used prior request. This has the same semantic than the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
		 */
		TEMPORARY_REDIRECT = 307,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-4
		 *
		 * The user has sent too many requests in a given amount of time ("rate limiting").
		 */
		TOO_MANY_REQUESTS = 429,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7235#section-3.1
		 *
		 * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated". That is, the client must authenticate itself to get the requested response.
		 */
		UNAUTHORIZED = 401,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7725
		 *
		 * The user-agent requested a resource that cannot legally be provided, such as a web page censored by a government.
		 */
		UNAVAILABLE_FOR_LEGAL_REASONS = 451,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.3
		 *
		 * The request was well-formed but was unable to be followed due to semantic errors.
		 */
		UNPROCESSABLE_ENTITY = 422,
		/**
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.13
		 *
		 * The media format of the requested data is not supported by the server, so the server is rejecting the request.
		 */
		UNSUPPORTED_MEDIA_TYPE = 415,
		/**
		 * @deprecated
		 * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.6
		 *
		 * Was defined in a previous version of the HTTP specification to indicate that a requested response must be accessed by a proxy. It has been deprecated due to security concerns regarding in-band configuration of a proxy.
		 */
		USE_PROXY = 305,
		/**
		 * Official Documentation @ https://datatracker.ietf.org/doc/html/rfc7540#section-9.1.2
		 *
		 * Defined in the specification of HTTP/2 to indicate that a server is not able to produce a response for the combination of scheme and authority that are included in the request URI.
		 */
		MISDIRECTED_REQUEST = 421,
	}

	export const INTERNAL_CODES: {
		SUCCESS: {
			CODE: 1;
			MESSAGE: {
				VI: "Thành công";
				EN: "Successful";
			};
		};
		FAILED: {
			CODE: 2;
			MESSAGE: {
				VI: "Thất bại";
				EN: "Process failed";
			};
		};
		PROCESSING: {
			CODE: 3;
			MESSAGE: {
				VI: "Đang xử lý";
				EN: "Processing";
			};
		};
		MISSING_PARAM: {
			CODE: 1000;
			MESSAGE: {
				VI: "Thiếu tham số";
				EN: "MISSING PARAM";
			};
			STATUS_CODE: 400;
		};
		PARAMS_INVALID_FORMAT: {
			CODE: 1001;
			MESSAGE: {
				VI: "Tham số sai định dạng";
				EN: "PARAMS INVALID FORMAT";
			};
		};
		ITEM_NOT_FOUND: {
			CODE: 1002;
			MESSAGE: {
				VI: "Không tìm thấy dữ liệu";
				EN: "ITEM NOT FOUND";
			};
		};
		EXISTED: {
			CODE: 1003;
			MESSAGE: {
				VI: "Dữ liệu đã tồn tại";
				EN: "EXISTED DATA";
			};
		};
		SAVING_FAILED: {
			CODE: 1004;
			MESSAGE: {
				VI: "Lưu dữ liệu không thành công!";
				EN: "SAVING FAILED";
			};
		};
		LOGIN_FAILED: {
			CODE: 1005;
			MESSAGE: {
				VI: "Mật khẩu không đúng. Vui lòng thử lại";
				EN: "Incorrect password. Please try again";
			};
		};
		PASSWORD_POLICY_INVALID: {
			CODE: 1006;
			MESSAGE: {
				VI: "Mật khẩu không đúng yêu cầu!";
				EN: "Password policy is invalid!";
			};
		};
		RESET_PASSWORD_TOKEN_EXPIRED: {
			CODE: 1007;
			MESSAGE: {
				VI: "Token reset mật khẩu đã hết hạn!";
				EN: "Reset password token is expired!";
			};
		};
		TOKEN_EXPIRED: {
			CODE: 1008;
			MESSAGE: {
				VI: "Phiên làm việc hết hạn";
				EN: "TOKEN_EXPIRED";
			};
		};
		USER_NOT_FOUND: {
			CODE: 1009;
			MESSAGE: {
				VI: "Người dùng không tồn tại!";
				EN: "User not found!";
			};
		};
		ACCOUNT_LOCKED: {
			CODE: 1010;
			MESSAGE: {
				VI: "Tài khoản của bạn đã bị khóa";
				EN: "Your account was locked";
			};
		};
		PASSWORD_INCORRECT: {
			CODE: 1011;
			MESSAGE: {
				VI: "Mật khẩu không chính xác";
				EN: "Your password incorrect";
			};
		};
		REFUND_AMOUNT_EXCEEDED: {
			CODE: 1012;
			MESSAGE: {
				VI: "Số tiền hoàn lại vượt quá mức cho phép";
				EN: "Refund amount exceeded";
			};
		};
	};

	export const GATE_CODES: {
		SUCCESS: {
			CODE: 1;
			MESSAGE: {
				VI: "Thành công";
				EN: "Successful";
			};
			STATUS_CODE: 200;
		};
		FAILED: {
			CODE: 2;
			MESSAGE: {
				VI: "Thất bại";
				EN: "Process failed";
			};
			STATUS_CODE: 500;
		};
	};

	export const PAYMENT_GATEWAY_CODES: {
		SUCCESS: {
			CODE: 0;
			MESSAGE: {
				VI: "Giao dịch thành công";
				EN: "Successful";
			};
		};
		IN_PROCESSING_OR_NOT_PAID: {
			CODE: 9;
			MESSAGE: {
				VI: "Giao dịch đang tiến hành hoặc chưa thanh toán";
				EN: "Giao dịch đang tiến hành hoặc chưa thanh toán";
			};
		};
		PENDING: {
			CODE: 99;
			MESSAGE: {
				VI: "Giao dịch pending";
				EN: "Giao dịch pending";
			};
		};
		SIGNATURE_INVALID: {
			CODE: 98;
			MESSAGE: {
				VI: "Chữ ký không hợp lệ";
				EN: "Chữ ký không hợp lệ";
			};
		};
		BANK_REJECT: {
			CODE: 1;
			MESSAGE: {
				VI: "Giao dịch không thành công. Ngân hàng phát hành thẻ từ chối cấp phép cho giao dịch. Vui lòng liên hệ ngân hàng theo số điện thoại sau mặt thẻ để biết chính xác nguyên nhân Ngân hàng từ chối";
				EN: "Giao dịch không thành công. Ngân hàng phát hành thẻ từ chối cấp phép cho giao dịch. Vui lòng liên hệ ngân hàng theo số điện thoại sau mặt thẻ để biết chính xác nguyên nhân Ngân hàng từ chối";
			};
		};
		TIME_EXPIRED: {
			CODE: 17;
			MESSAGE: {
				VI: "Giao dịch không thành công. Quá thời gian thanh toán. Vui lòng thực hiện thanh toán lại";
				EN: "Giao dịch không thành công. Quá thời gian thanh toán. Vui lòng thực hiện thanh toán lại";
			};
		};
		USER_CANCEL: {
			CODE: 18;
			MESSAGE: {
				VI: "Giao dịch không thành công. Người sử dụng hủy giao dịch";
				EN: "Giao dịch không thành công. Người sử dụng hủy giao dịch";
			};
		};
		PAYMENT_GW_NOT_APPROVED: {
			CODE: 30;
			MESSAGE: {
				VI: "Thông tin tích hợp cổng thanh toán chưa được duyệt";
				EN: "Payment gateway info not approved";
			};
		};
	};

	export const STATE: {
		PROCESSING: 1;
		DONE: 2;
		FAILED: 3;
	};
}
