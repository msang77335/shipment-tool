export interface IResponseBase<T> {
	code: number;
	state?: number;
	data: T;
	message: string;
}