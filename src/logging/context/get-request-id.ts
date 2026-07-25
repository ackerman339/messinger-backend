import { asyncLocalStorage } from './async-context';

export const getRequestId = () => asyncLocalStorage.getStore()?.requestId;
