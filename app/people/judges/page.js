'use client';
import { useEffect } from 'react';
import PeopleListView from '../../../components/PeopleListView';

export default function JudgesPage() {
  useEffect(() => {
    document.title = 'Directory';
  }, []);

  return <PeopleListView title="Judges" identityFilter="Judge" />;
}
