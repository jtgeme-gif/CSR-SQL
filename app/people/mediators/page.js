'use client';
import { useEffect } from 'react';
import PeopleListView from '../../../components/PeopleListView';

export default function MediatorsPage() {
  useEffect(() => {
    document.title = 'Directory';
  }, []);

  return <PeopleListView title="Mediators" mediatorFilter={true} />;
}
