export class PagingResult<TEntity> {
	public readonly docs: TEntity[];
	public readonly totalDocs: number;
	public readonly offset?: number;
	public readonly limit?: number;

	public constructor(items: TEntity[], total: number, offset?: number, limit?: number) {
		this.docs = items;
		this.totalDocs = total;
		this.offset = offset;
		this.limit = limit;
	}
}
