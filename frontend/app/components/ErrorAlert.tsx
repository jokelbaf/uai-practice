
export default function ErrorAlert({ message }: { message: string }) {
    return (
        <div className='bg-red-500/20 border border-red-500 rounded-xl text-red-500 flex p-3'>
            {message}
        </div>
    );
}
