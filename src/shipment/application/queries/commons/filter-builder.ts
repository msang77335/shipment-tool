import { FilterOperator } from "../../../infracstructure/queries/filter-operator";

export interface FilterAndData {
	modelValue: any;
	operator: FilterOperator;
}
export class FilterBuilder<TFilter> {
	private readonly filter: TFilter;

	public constructor() {
		this.filter = {} as TFilter;
	}

	public static init<TFilter>() {
		return new FilterBuilder<TFilter>();
	}

	public withData(modelKey: string, modelValue: any, operator: FilterOperator): this {
		if (modelValue != null) {
			this.filter[modelKey] = {
				operator,
				data: modelValue,
			};
		}
		return this;
	}

	public withAnd(modelKey: string, data: FilterAndData[]): this {
		if (data[0].modelValue != null && data[1].modelValue != null) {
			this.filter[modelKey] = {};
			data.forEach(item => {
				this.filter[modelKey][item.operator] = item.modelValue;
			});
		}
		return this;
	}

	public build(): TFilter {
		return this.filter;
	}
}
