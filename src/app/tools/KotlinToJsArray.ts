export default class KotlinToJsArray {
    static toJsByteArray(kotlinJsArray: any): Int8Array {
        return new Int8Array(kotlinJsArray)
    }
}