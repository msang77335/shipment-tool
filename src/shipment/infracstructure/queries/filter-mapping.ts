import { FilterOperator } from "./filter-operator";

export const filterMapping = <TFilter>(filter: TFilter) => {
	const keys = Object.keys(filter);
	const data = keys.map((item: any) => {
		const elem = {};
		const op = filter[item].operator;

		switch (op) {
			case FilterOperator.EQUAL: {
				elem[item] = filter[item].data;
				break;
			}
			case FilterOperator.LESS_THAN_N_EQUAL: {
				elem[item] = { $lte: filter[item].data };
				break;
			}
			case FilterOperator.GREATER_THAN_N_EQUAL: {
				elem[item] = { $gte: filter[item].data };
				break;
			}
			case FilterOperator.ELEMENT_MATCH: {
				elem[item] = { $elemMatch: { $eq: filter[item].data } };
				break;
			}
			default: {
				elem[item] = filter[item];
				break;
			}
		}
		return elem;
	});
	let dataObj = {};
	data.forEach(item => {
		dataObj = { ...dataObj, ...item };
	});

	return dataObj;
};
