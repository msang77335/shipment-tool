export enum FilterOperator {
	EQUAL = "$eq",
	NOT_EQUAL = "$neq",
	LESS_THAN = "$lt",
	GREATER_THAN = "$gt",
	LESS_THAN_N_EQUAL = "$lte",
	GREATER_THAN_N_EQUAL = "$gte",
	ELEMENT_MATCH = "$elemMatch",
	OR = "$or",
}
