import { BasePagingDto } from "../../../interface/dtos/commons/paging";

interface PaginationOptions {
  offset: number,
  limit: number,
  sort?: object
}

export const createPaginationOptions = (query: BasePagingDto): PaginationOptions => {
  const { pageIndex, pageSize, sortBy, sortType } = query;

  const options: PaginationOptions = {
    offset: (pageIndex - 1) * pageSize,
    limit: pageSize,
  };

  if (sortBy && sortType) {
    if (!isNaN(+sortType)) {
      options.sort = {
        [sortBy]: +sortType,
      };
    } else {
      options.sort = {
        [sortBy]: sortType,
      };
    }
  }

  return options;
};