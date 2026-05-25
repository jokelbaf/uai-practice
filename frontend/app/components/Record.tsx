import { useEffect, useRef } from 'react';

import type { Record } from '~/types/record';


function StateBlock({ state, name }: { state: number, name: string }) {
    return (
        <div
            className='flex items-center justify-center w-16 h-16 text-white font-bold'
            style={{  backgroundColor: state === 0 ? 'green' : 'red' }}
        >
            {name}
        </div>
    );
}

export default function Record({ record }: { record: Record }) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        let pc: RTCPeerConnection | null = new RTCPeerConnection();
        let isCancelled = false;

        const start = async () => {
            if (!pc) return;

            pc.ontrack = (event) => {
                if (!videoRef.current || isCancelled) return;
                videoRef.current.srcObject = event.streams[0];
            };

            pc.addTransceiver('video', { direction: 'recvonly' });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const response = await fetch(`/api/stream/${record.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type,
                }),
            });

            if (!response.ok) {
                return;
            }

            const answer = await response.json();
            await pc.setRemoteDescription(answer);
        };

        start();

        return () => {
            isCancelled = true;
            pc?.close();
            pc = null;
        };
    }, [record.id]);

    return (
        <div className='p-2'>
            <div className='pb-2 text-lg font-medium'>
                Record #{ record.id }
            </div>
            <div className='flex'>
                <div className='flex flex-col h-96 justify-between'>
                    <StateBlock state={record.t1} name="#1" />
                    <StateBlock state={record.t3} name="#3" />
                </div>
                <div className='w-2xl h-96 flex items-center justify-center bg-slate-200 rounded-md overflow-hidden'>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        controls={false}
                        className='w-full h-full object-cover'
                    />
                </div>
                <div className='flex flex-col h-96 justify-between'>
                    <StateBlock state={record.t2} name="#2" />
                    <StateBlock state={record.t4} name="#4" />
                </div>
            </div>
            <div className='flex justify-center w-200'>
                <StateBlock state={record.state} name="State" />
            </div>
        </div>
    );
}
